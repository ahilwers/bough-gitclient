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
	"errors"
	"fmt"
	"os/exec"
	"strings"
	"sync"
)

// Failure keeps untrusted diagnostics out of Error(), IPC and state stores.
// Diagnostics are bounded and may only be exported by an explicit user action.
type Failure struct {
	Operation string
	ExitCode  int
	Category  string
	raw       string
	cause     error
}

func (f *Failure) Error() string {
	if f.Category == "already-exists" && f.Operation == "tag" {
		return fmt.Sprintf("git tag failed (exit %d; tag already exists). Details omitted.", f.ExitCode)
	}
	return fmt.Sprintf("git %s failed (exit %d; %s). Details omitted.", f.Operation, f.ExitCode, f.Category)
}
func (f *Failure) Unwrap() error      { return f.cause }
func (f *Failure) Diagnostic() string { return f.raw }

func diagnostic(err error) string {
	var f *Failure
	if errors.As(err, &f) {
		return f.raw
	}
	return err.Error()
}

// operation accepts only fixed command names, never arbitrary arguments.
func operation(args []string) string {
	for len(args) > 0 {
		switch args[0] {
		case "-c":
			if len(args) < 2 {
				return "unknown"
			}
			args = args[2:]
			continue
		case "--no-replace-objects":
			args = args[1:]
			continue
		case "add", "restore", "apply", "stash", "pull", "push", "fetch", "rebase", "merge", "commit", "cherry-pick", "branch", "tag", "worktree", "checkout", "switch", "reset", "revert", "rm", "show", "diff", "config", "rev-parse", "ls-remote", "credential", "clone", "status", "log":
			return args[0]
		default:
			return "unknown"
		}
	}
	return "unknown"
}

// diagnosticBuffer drains output without retaining more than 64 KiB.
// Stdout and stderr may be written concurrently by os/exec.
type diagnosticBuffer struct {
	mu   sync.Mutex
	data []byte
}

func (b *diagnosticBuffer) Write(data []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	n := len(data)
	remaining := 65536 - len(b.data)
	if len(data) > remaining {
		data = data[:remaining]
	}
	b.data = append(b.data, data...)
	return n, nil
}
func (b *diagnosticBuffer) String() string { b.mu.Lock(); defer b.mu.Unlock(); return string(b.data) }
func capturedOutput(cmd *exec.Cmd) ([]byte, error) {
	var out diagnosticBuffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return []byte(out.String()), err
}

func newFailure(args []string, err error, raw string) *Failure {
	code := -1
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		code = exit.ExitCode()
	}
	if len(raw) > 64*1024 {
		raw = raw[:64*1024]
	}
	category := "unknown"
	op := operation(args)
	text := strings.ToLower(raw)
	switch {
	case op == "tag" && strings.Contains(text, "already exists"):
		category = "already-exists"
	case errors.Is(err, context.DeadlineExceeded):
		category = "timeout"
	case errors.Is(err, context.Canceled):
		category = "cancelled"
	case strings.Contains(text, "authentication failed"), strings.Contains(text, "permission denied (publickey"), strings.Contains(text, "could not read username"):
		category = "authentication"
	case strings.Contains(text, "could not resolve host"), strings.Contains(text, "unable to access"), strings.Contains(text, "connection timed out"):
		category = "network"
	case strings.Contains(text, "index.lock"):
		category = "locked"
	case strings.Contains(text, "non-fast-forward"), strings.Contains(text, "[rejected]"):
		category = "rejected"
	}
	return &Failure{Operation: op, ExitCode: code, Category: category, raw: raw, cause: err}
}
