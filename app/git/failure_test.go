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
	"context"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"unicode/utf8"
)

func exitError(t *testing.T, code int) error {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("fixture uses a POSIX shell")
	}
	err := exec.Command("sh", "-c", "exit "+strconv.Itoa(code)).Run()
	if err == nil {
		t.Fatalf("command exited 0, want %d", code)
	}
	return err
}

func TestFailureKeepsGitOutputVerbatim(t *testing.T) {
	raw := "Preparing worktree (checking out 'test01')\nfatal: 'test01' is already used by worktree at '/tmp/boughtest'\n"
	failure := newFailure([]string{"worktree", "add", "../wt", "test01"}, exitError(t, 128), raw)

	message := failure.Error()
	// Git's own text is what the UI shows, line for line.
	if !strings.Contains(message, "fatal: 'test01' is already used by worktree at '/tmp/boughtest'") {
		t.Fatalf("git output missing from message: %q", message)
	}
	if !strings.Contains(message, "Preparing worktree (checking out 'test01')") {
		t.Fatalf("first output line missing: %q", message)
	}
	if !strings.HasPrefix(message, "git worktree failed (exit 128)\n") {
		t.Fatalf("unexpected header: %q", message)
	}
	// Command arguments must not be echoed; only the fixed operation name may
	// appear.
	if strings.Contains(message, "../wt") {
		t.Fatalf("command arguments leaked: %q", message)
	}
}

func TestFailureWithoutOutputExplainsCause(t *testing.T) {
	failure := newFailure([]string{"rebase"}, context.DeadlineExceeded, "")
	if got := failure.Error(); got != "git rebase failed: context deadline exceeded" {
		t.Fatalf("message = %q", got)
	}

	silent := newFailure([]string{"add"}, exitError(t, 3), "")
	if got := silent.Error(); got != "git add failed (exit 3)" {
		t.Fatalf("silent failure = %q", got)
	}
}

func TestFailureWithoutOperationSaysOnlyGit(t *testing.T) {
	failure := newFailure([]string{"--upload-pack=evil"}, exitError(t, 2), "fatal: nope")
	if got := failure.Error(); !strings.HasPrefix(got, "git failed (exit 2)\n") {
		t.Fatalf("message = %q", got)
	}
}

func TestOutputIsBounded(t *testing.T) {
	failure := newFailure([]string{"status"}, exitError(t, 1), strings.Repeat("x", maxOutputBytes*2))
	if len(failure.Output) != maxOutputBytes {
		t.Fatalf("output length = %d, want %d", len(failure.Output), maxOutputBytes)
	}
}

func TestOutputTruncationKeepsValidUTF8(t *testing.T) {
	failure := newFailure([]string{"status"}, exitError(t, 1), strings.Repeat("ä", maxOutputBytes))
	if len(failure.Output) > maxOutputBytes {
		t.Fatalf("output exceeds bound: %d", len(failure.Output))
	}
	if !utf8.ValidString(failure.Output) {
		t.Fatal("truncation split a UTF-8 sequence")
	}
}

func TestOperationSkipsGlobalOptions(t *testing.T) {
	for _, tc := range []struct {
		args []string
		want string
	}{
		{[]string{"-c", "tag.gpgSign=false", "tag", "--", "v1"}, "tag"},
		{[]string{"--no-replace-objects", "log"}, "log"},
		{[]string{"-c"}, "unknown"},
		{[]string{"--upload-pack=evil"}, "unknown"},
		{nil, "unknown"},
	} {
		if got := operation(tc.args); got != tc.want {
			t.Errorf("operation(%q) = %q, want %q", tc.args, got, tc.want)
		}
	}
}

// The end-to-end path: a failing CLI call must carry Git's message, not a
// classified summary.
func TestCLIFailureCarriesGitMessage(t *testing.T) {
	_, err := CLI(t.TempDir(), "show", "HEAD")
	if err == nil {
		t.Fatal("expected failure outside a repository")
	}
	message := err.Error()
	if !strings.Contains(message, "fatal: not a git repository") {
		t.Fatalf("git diagnostic missing: %q", message)
	}
	if !strings.HasPrefix(message, "git show failed (exit 128)") {
		t.Fatalf("unexpected header: %q", message)
	}
	if strings.Contains(message, "Details omitted") || strings.Contains(message, "unknown)") {
		t.Fatalf("classified summary leaked back in: %q", message)
	}
}
