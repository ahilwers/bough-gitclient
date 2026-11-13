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
	"fmt"
	"os/exec"
	"strings"
	"sync"
	"unicode/utf8"
)

// maxOutputBytes bounds the output kept in memory for one failed command. The
// complete text is handed to the UI, so this is also the most a details dialog
// can show.
const maxOutputBytes = 64 * 1024

// Failure carries what Git actually printed.
//
// The message is Git's own output, prefixed with the operation and exit code so
// that a command which fails silently still explains itself. Command arguments
// are never echoed. The app shows the first lines in a toast and the complete
// text in a details dialog; nothing is written to disk.
type Failure struct {
	Operation string
	ExitCode  int
	Output    string
	cause     error
}

func (f *Failure) Error() string {
	header := "git"
	if f.Operation != "" && f.Operation != "unknown" {
		header += " " + f.Operation
	}
	header += " failed"
	if f.ExitCode > 0 {
		header += fmt.Sprintf(" (exit %d)", f.ExitCode)
	}
	if output := strings.TrimRight(f.Output, "\r\n"); output != "" {
		return header + "\n" + output
	}
	// No output at all: the cause is the only information there is. For an
	// exit status that would repeat the header, so it is left out.
	if f.cause != nil && !isExitStatus(f.cause) {
		return header + ": " + f.cause.Error()
	}
	return header
}

func (f *Failure) Unwrap() error { return f.cause }

func isExitStatus(err error) bool {
	var exit *exec.ExitError
	return errors.As(err, &exit)
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

// truncateOutput cuts to maxOutputBytes without splitting a UTF-8 sequence.
func truncateOutput(raw string) string {
	if len(raw) <= maxOutputBytes {
		return raw
	}
	raw = raw[:maxOutputBytes]
	for len(raw) > 0 && !utf8.ValidString(raw) {
		raw = raw[:len(raw)-1]
	}
	return raw
}

// outputBuffer drains subprocess output without retaining more than
// maxOutputBytes. Stdout and stderr may be written concurrently by os/exec.
type outputBuffer struct {
	mu   sync.Mutex
	data []byte
}

func (b *outputBuffer) Write(data []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	n := len(data)
	remaining := maxOutputBytes - len(b.data)
	if len(data) > remaining {
		data = data[:remaining]
	}
	b.data = append(b.data, data...)
	return n, nil
}

func (b *outputBuffer) String() string { b.mu.Lock(); defer b.mu.Unlock(); return string(b.data) }

// capturedOutput runs cmd and returns its combined output.
func capturedOutput(cmd *exec.Cmd) ([]byte, error) {
	var out outputBuffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return []byte(out.String()), err
}

// diagnostic returns the text Git printed for err: the captured output of a
// command failure, otherwise the error's own message.
func diagnostic(err error) string {
	var failure *Failure
	if errors.As(err, &failure) && failure.Output != "" {
		return failure.Output
	}
	return err.Error()
}

func newFailure(args []string, err error, raw string) *Failure {
	code := -1
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		code = exit.ExitCode()
	}
	return &Failure{
		Operation: operation(args),
		ExitCode:  code,
		Output:    truncateOutput(raw),
		cause:     err,
	}
}
