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

package git

import (
	"errors"
	"strings"
	"testing"
)

func TestDiagnosticCaptureIsBounded(t *testing.T) {
	var buffer diagnosticBuffer
	input := strings.Repeat("secret", 100000)
	n, err := buffer.Write([]byte(input))
	if err != nil || n != len(input) {
		t.Fatal("writer must drain subprocess output")
	}
	if len(buffer.String()) != 65536 {
		t.Fatalf("capture length %d", len(buffer.String()))
	}
}

func TestDirectGitFailuresAreStructured(t *testing.T) {
	repo := &Repository{Path: t.TempDir()}
	for name, run := range map[string]func() error{
		"stage":   func() error { return repo.StageHunkViaApply("secret-token") },
		"unstage": func() error { return repo.UnstageHunkViaApply("secret-token") },
		"discard": func() error { return repo.DiscardHunk("secret-token") },
		"stash":   func() error { return repo.ApplyStashHunk("secret-token") },
		"pull":    func() error { return pullCLI(repo.Path, "pull") },
		"rebase":  repo.ContinueRebase,
	} {
		t.Run(name, func(t *testing.T) {
			err := run()
			var failure *Failure
			if !errors.As(err, &failure) {
				t.Fatalf("missing structured error: %v", err)
			}
			if strings.Contains(err.Error(), "secret-token") || len(failure.Diagnostic()) > 65536 {
				t.Fatal("unsafe diagnostic")
			}
		})
	}
}

func TestPullConflictRetainsOnlyBackendFailure(t *testing.T) {
	r := pullFixture(t, true, true)
	result, err := r.PullForUI(r.Path, "main")
	if err != nil {
		t.Fatal(err)
	}
	if result.Snapshot == nil {
		t.Fatal("expected strategy choice")
	}
	result, err = r.ResolvePull(*result.Snapshot, "merge")
	if err != nil {
		t.Fatal(err)
	}
	if result.Outcome != "conflict" || result.Failure == nil || result.Detail != "" {
		t.Fatalf("missing backend-only failure: %+v", result)
	}
}

func TestCLIFailureDoesNotExposeArgumentsOrOutput(t *testing.T) {
	_, err := CLI(t.TempDir(), "show", "secret-token")
	if err == nil {
		t.Fatal("expected failure")
	}
	if strings.Contains(err.Error(), "secret-token") || strings.Contains(err.Error(), "fatal:") {
		t.Fatalf("unsafe error: %v", err)
	}
	var failure *Failure
	if !errors.As(err, &failure) {
		t.Fatal("missing structured failure")
	}
	if failure.Operation != "show" || failure.ExitCode != 128 {
		t.Fatalf("wrong metadata: %+v", failure)
	}
	if !strings.Contains(failure.Diagnostic(), "fatal:") {
		t.Fatal("raw diagnostic unavailable")
	}
}
