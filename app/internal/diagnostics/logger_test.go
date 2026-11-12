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

package diagnostics

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOversizedExistingLogFailsClosed(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	os.Mkdir(dir, 0700)
	path := filepath.Join(dir, "agent.log")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	file.Truncate(2*1024*1024 + 1)
	file.Close()
	l := New(dir)
	defer l.Close()
	if l.file != nil {
		t.Fatal("oversized file would violate archive byte limit")
	}
}

func TestOversizedExistingArchivesFailClosed(t *testing.T) {
	for _, name := range []string{"agent.log.1", "agent.log.2", "agent.log.3", "agent.log.4"} {
		t.Run(name, func(t *testing.T) {
			dir := filepath.Join(t.TempDir(), "logs")
			if err := os.Mkdir(dir, 0700); err != nil {
				t.Fatal(err)
			}
			file, err := os.OpenFile(filepath.Join(dir, name), os.O_CREATE|os.O_WRONLY, 0600)
			if err != nil {
				t.Fatal(err)
			}
			if err := file.Truncate(2*1024*1024 + 1); err != nil {
				t.Fatal(err)
			}
			file.Close()
			l := New(dir)
			defer l.Close()
			if l.file != nil || l.reason != "protection" {
				t.Fatal("oversized archive did not disable logging at startup")
			}
		})
	}
}

func TestConcurrentLoggerFailsClosed(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	first := New(dir)
	defer first.Close()
	second := New(dir)
	defer second.Close()
	if second.file != nil {
		t.Fatal("concurrent writer can bypass rotation bounds")
	}
}

func TestProtectedRotation(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	l := New(dir)
	defer l.Close()
	// More than ten megabytes must leave at most five bounded files.
	for i := 0; i < 120000; i++ {
		l.Record("push", 128, "unknown")
	}
	all, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var entries []os.DirEntry
	for _, entry := range all {
		if strings.HasPrefix(entry.Name(), "agent.log") {
			entries = append(entries, entry)
		}
	}
	if len(entries) != 5 {
		t.Fatalf("expected five files, got %d", len(entries))
	}
	for _, entry := range entries {
		info, _ := entry.Info()
		if info.Size() > 2*1024*1024 {
			t.Fatalf("oversized %s: %d", entry.Name(), info.Size())
		}
	}
}

func TestLogAllowlist(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	l := New(dir)
	defer l.Close()
	l.Record("push", 128, "authentication")
	l.Record("push|fetch", 1, "network|secret")
	l.Record("secret-token", 1, "https://secret@example.com")
	data, err := os.ReadFile(filepath.Join(dir, "agent.log"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "secret") {
		t.Fatal("untrusted text persisted")
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 3 {
		t.Fatalf("lines: %s", data)
	}
	if strings.Contains(string(data), "push|fetch") {
		t.Fatal("non-enum operation persisted")
	}
	for _, line := range lines {
		var record map[string]any
		if err := json.Unmarshal([]byte(line), &record); err != nil {
			t.Fatal(err)
		}
		if len(record) != 4 || record["timestamp"] == nil {
			t.Fatalf("unexpected schema: %v", record)
		}
	}
}
