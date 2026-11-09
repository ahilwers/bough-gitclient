// Copyright (C) 2026 Achim Hilwers
//
// This file is part of Bough.
//
// Bough is free software: you can redistribute it and/or modify it under the
// terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version. See the LICENSE file in the repository root for details.
//
// SPDX-License-Identifier: GPL-3.0-or-later

package git

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"time"

	"bough/internal/sysproc"
)

// cliTimeout is the maximum time a single git subprocess may run.
// Any command that exceeds this is killed and returns an error.
// 15 seconds is generous for all local operations; hung credential
// prompts or index-lock contention are cut off before they freeze the UI.
const cliTimeout = 15 * time.Second

// CLI runs a git command and returns stdout as a string.
// It always completes within cliTimeout, returning an error if the deadline
// is exceeded so callers never block the IPC handler goroutine indefinitely.
// Empty args are silently ignored (useful for conditional flags).
func CLI(dir string, args ...string) (string, error) {
	return cliWithEnv(dir, nil, args...)
}

// cliWithEnv runs Git with additional environment variables overriding the
// inherited environment. CLI calls it without overrides.
func cliWithEnv(dir string, env []string, args ...string) (string, error) {
	filtered := make([]string, 0, len(args))
	for _, a := range args {
		if a != "" {
			filtered = append(filtered, a)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), cliTimeout)
	defer cancel()

	cmd := sysproc.CommandContext(ctx, "git", filtered...)
	cmd.Dir = dir
	if len(env) > 0 {
		cmd.Env = append(os.Environ(), env...)
	}
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return "", fmt.Errorf("git %v: timed out after %s", filtered, cliTimeout)
		}
		return "", fmt.Errorf("git %v: %w\n%s", filtered, err, stderr.String())
	}
	return stdout.String(), nil
}

// execGit creates an exec.Cmd for git without running it.
// Use this when you need to control Stdin or stream output.
func execGit(dir string, args ...string) *exec.Cmd {
	cmd := sysproc.Command("git", args...)
	cmd.Dir = dir
	return cmd
}
