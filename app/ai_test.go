// Copyright (C) 2026 Achim Hilwers
//
// This file is part of GitMorrow.
//
// GitMorrow is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAIRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Method != "POST" {
			t.Error("wrong API route")
		}
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Error("missing auth")
		}
		var body struct {
			Model    string
			Messages []struct{ Role, Content string }
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if body.Model != "test-model" || len(body.Messages) != 2 || !strings.Contains(body.Messages[1].Content, "staged-only") {
			t.Error("incorrect payload")
		}
		w.Write([]byte(`{"choices":[{"message":{"content":"Add feature\n\nExplain the change."}}]}`))
	}))
	defer server.Close()
	got, err := requestCommitMessage(context.Background(), server.Client(), AISettings{BaseURL: server.URL + "/v1", Model: "test-model"}, "secret", "staged-only")
	if err != nil || got != "Add feature\n\nExplain the change." {
		t.Fatalf("%q %v", got, err)
	}
}

func TestAIResponseErrors(t *testing.T) {
	for _, test := range []struct {
		name   string
		status int
		body   string
	}{
		{"unauthorized", 401, "sensitive-provider-secret"}, {"rate limit", 429, "quota"}, {"malformed", 200, "not JSON"}, {"empty choices", 200, `{"choices":[]}`}, {"empty content", 200, `{"choices":[{"message":{"content":" "}}]}`}, {"oversized", 200, strings.Repeat("x", 32769)},
	} {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(test.status); w.Write([]byte(test.body)) }))
			defer server.Close()
			_, err := requestCommitMessage(context.Background(), server.Client(), AISettings{BaseURL: server.URL}, "secret", "diff")
			if err == nil || strings.Contains(err.Error(), "sensitive-provider-secret") {
				t.Fatalf("unsafe or missing error: %v", err)
			}
		})
	}
}

func TestAIRequestBoundsAndCancellation(t *testing.T) {
	for _, diff := range []string{"", strings.Repeat("x", maxAIDiff+1)} {
		if _, err := requestCommitMessage(context.Background(), http.DefaultClient, AISettings{}, "", diff); err == nil {
			t.Fatal("expected input bound error")
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := requestCommitMessage(ctx, &http.Client{Timeout: time.Second}, AISettings{BaseURL: "https://example.invalid"}, "key", "diff"); err == nil {
		t.Fatal("expected cancellation")
	}
	var b boundedBuffer
	if _, err := b.Write(make([]byte, maxAIDiff+1)); err == nil || b.Len() != 0 {
		t.Fatal("bounded diff accepted oversized data")
	}
	if _, err := b.Write(make([]byte, maxAIDiff)); err != nil || b.Len() != maxAIDiff {
		t.Fatalf("bounded diff rejected exact limit: %v", err)
	}
	if _, err := b.Write([]byte("x")); err == nil || b.Len() != maxAIDiff {
		t.Fatal("bounded diff accepted cumulative overflow")
	}
}

func TestAIRequestAcceptsLargerDiffsAndLimit(t *testing.T) {
	received := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct{ Content string }
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
			return
		}
		if len(body.Messages) != 2 {
			t.Error("expected system and user messages")
			return
		}
		received <- body.Messages[1].Content
		w.Write([]byte(`{"choices":[{"message":{"content":"Describe changes"}}]}`))
	}))
	defer server.Close()

	for _, size := range []int{64*1024 + 1, maxAIDiff} {
		diff := strings.Repeat("x", size)
		_, err := requestCommitMessage(context.Background(), server.Client(), AISettings{BaseURL: server.URL}, "key", diff)
		if err != nil {
			t.Fatalf("size %d: %v", size, err)
		}
		if got := <-received; got != "Staged diff:\n"+diff {
			t.Fatalf("size %d: diff was not sent in full", size)
		}
	}
}

func TestStagedAIDiffLargerThanPreviousLimit(t *testing.T) {
	dir := t.TempDir()
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git: %s %v", out, err)
		}
	}
	run("init")
	path := filepath.Join(dir, "large.txt")
	content := strings.Repeat("staged content\n", 5000)
	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
	run("add", "large.txt")
	diff, err := stagedAIDiff(context.Background(), dir)
	if err != nil || len(diff) <= 64*1024 || !strings.Contains(diff, "+staged content") {
		t.Fatalf("expected full diff larger than 64 KiB, got %d bytes: %v", len(diff), err)
	}

	if err := os.WriteFile(path, []byte(strings.Repeat("staged content\n", maxAIDiff/10)), 0600); err != nil {
		t.Fatal(err)
	}
	run("add", "large.txt")
	if _, err := stagedAIDiff(context.Background(), dir); err == nil || !strings.Contains(err.Error(), "512 KiB") {
		t.Fatalf("expected oversized diff error with current limit, got %v", err)
	}
}

func TestAISettingsValidation(t *testing.T) {
	for _, url := range []string{"http://remote.example/v1", "https://user:secret@example.com", "https://example.com?key=secret", "file:///tmp/test"} {
		if validateAISettings(AISettings{Provider: "openrouter", BaseURL: url, Model: "model"}) == nil {
			t.Errorf("accepted %s", url)
		}
	}
	for _, url := range []string{"https://openrouter.ai/api/v1", "http://127.0.0.1:1234/v1"} {
		if err := validateAISettings(AISettings{Provider: "openrouter", BaseURL: url, Model: "model"}); err != nil {
			t.Error(err)
		}
	}
}

func TestStagedAIDiffExcludesWorktree(t *testing.T) {
	dir := t.TempDir()
	run := func(args ...string) {
		t.Helper()
		cmd := exec.Command("git", append([]string{"-C", dir}, args...)...)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git: %s %v", out, err)
		}
	}
	run("init")
	path := filepath.Join(dir, "change.txt")
	if err := os.WriteFile(path, []byte("staged-content\n"), 0600); err != nil {
		t.Fatal(err)
	}
	run("add", "change.txt")
	if err := os.WriteFile(path, []byte("unstaged-private-content\n"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "untracked.txt"), []byte("untracked-private"), 0600); err != nil {
		t.Fatal(err)
	}
	diff, err := stagedAIDiff(context.Background(), dir)
	if err != nil || !strings.Contains(diff, "staged-content") || strings.Contains(diff, "unstaged-private") || strings.Contains(diff, "untracked") {
		t.Fatalf("incorrect staged diff: %q %v", diff, err)
	}
	run("rm", "--cached", "-f", "change.txt")
	if _, err := stagedAIDiff(context.Background(), dir); err == nil {
		t.Fatal("expected empty staging error")
	}
}
