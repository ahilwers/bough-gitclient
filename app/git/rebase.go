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
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"bough/internal/sysproc"
)

// StartInteractiveRebase performs an interactive rebase non-interactively by
// pre-writing the rebase todo file via GIT_SEQUENCE_EDITOR.
//
// actions are in newest-first order (as displayed in the UI); the function
// reverses them internally to produce the oldest-first order git expects.
//
// "reword" actions are converted to "pick" + "exec git commit --amend -F <file>"
// so no interactive editor needs to open.
func (r *Repository) StartInteractiveRebase(actions []RebaseAction) error {
	if len(actions) == 0 {
		return fmt.Errorf("no actions provided")
	}

	// Reverse to oldest-first (git todo order).
	n := len(actions)
	ordered := make([]RebaseAction, n)
	for i, a := range actions {
		ordered[n-1-i] = a
	}

	// For each "reword" action, write the new message to a temp file so we
	// can use "exec git commit --amend -F <file>" without opening an editor.
	msgFiles := make(map[string]string) // full hash → temp file path
	for _, a := range ordered {
		if a.Action == "reword" {
			f, err := os.CreateTemp("", "bough-msg-*.txt")
			if err != nil {
				return fmt.Errorf("failed to create message file: %w", err)
			}
			if _, err := f.WriteString(a.Message + "\n"); err != nil {
				f.Close()
				return fmt.Errorf("failed to write message: %w", err)
			}
			f.Close()
			msgFiles[a.Hash] = f.Name()
		}
	}
	defer func() {
		for _, p := range msgFiles {
			os.Remove(p)
		}
	}()

	// Build the todo file content.
	var sb strings.Builder
	for _, a := range ordered {
		// Use short hash (7 chars) as is conventional in rebase todo files.
		hash := a.Hash
		if len(hash) > 7 {
			hash = hash[:7]
		}
		// First line of message only (no newlines allowed in todo entries).
		subject := strings.SplitN(a.Message, "\n", 2)[0]

		action := a.Action
		if action == "reword" {
			// Convert to pick + exec amend so no editor opens.
			action = "pick"
		}
		sb.WriteString(fmt.Sprintf("%s %s %s\n", action, hash, subject))

		if a.Action == "reword" {
			// Use forward slashes so the path works inside git's sh.exe on Windows.
			msgPath := filepath.ToSlash(msgFiles[a.Hash])
			sb.WriteString(fmt.Sprintf("exec git commit --amend -F %q\n", msgPath))
		}
	}

	// Write todo to a temp file.
	todoFile, err := os.CreateTemp("", "bough-rebase-todo-*.txt")
	if err != nil {
		return fmt.Errorf("failed to create todo file: %w", err)
	}
	todoPath := todoFile.Name()
	defer os.Remove(todoPath)
	if _, err := todoFile.WriteString(sb.String()); err != nil {
		todoFile.Close()
		return fmt.Errorf("failed to write todo: %w", err)
	}
	todoFile.Close()

	// Base: parent of the oldest commit in the sequence.
	base := ordered[0].Hash + "^"

	// GIT_SEQUENCE_EDITOR: write a small executable script that copies our
	// pre-written todo file over whatever path git passes as the first argument.
	// Using an actual script file is more reliable than an inline shell command
	// because git may exec the editor directly (without sh -c) on some platforms.
	var seqEditor string
	if runtime.GOOS == "windows" {
		// On Windows create a .bat file.
		scriptFile, err := os.CreateTemp("", "bough-seq-editor-*.bat")
		if err != nil {
			return fmt.Errorf("failed to create sequence editor: %w", err)
		}
		seqEditor = scriptFile.Name()
		defer os.Remove(seqEditor)
		// "%~1" strips surrounding quotes from the argument and handles spaces in paths.
		fmt.Fprintf(scriptFile, "@echo off\ncopy /Y %q \"%%~1\" >nul\n", todoPath)
		scriptFile.Close()
	} else {
		scriptFile, err := os.CreateTemp("", "bough-seq-editor-*.sh")
		if err != nil {
			return fmt.Errorf("failed to create sequence editor: %w", err)
		}
		seqEditor = scriptFile.Name()
		defer os.Remove(seqEditor)
		fmt.Fprintf(scriptFile, "#!/bin/sh\ncp %q \"$1\"\n", todoPath)
		scriptFile.Close()
		if err := os.Chmod(seqEditor, 0o755); err != nil {
			return fmt.Errorf("failed to make sequence editor executable: %w", err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	cmd := sysproc.CommandContext(ctx, "git", "rebase", "--interactive", "--autostash", base)
	cmd.Dir = r.Path
	cmd.Env = append(os.Environ(),
		"GIT_SEQUENCE_EDITOR="+seqEditor,
		"GIT_EDITOR=true",         // suppress squash/fixup message editor
		"GIT_TERMINAL_PROMPT=0",   // no credential prompts
	)

	var outBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &outBuf
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return fmt.Errorf("rebase timed out")
		}
		return fmt.Errorf("%s", strings.TrimSpace(outBuf.String()))
	}
	return nil
}

// ContinueRebase continues an interactive rebase after conflicts have been resolved.
// GIT_EDITOR=true prevents git from opening an editor for the commit message.
func (r *Repository) ContinueRebase() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := sysproc.CommandContext(ctx, "git", "rebase", "--continue")
	cmd.Dir = r.Path
	cmd.Env = append(os.Environ(), "GIT_EDITOR=true")

	var outBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &outBuf
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return fmt.Errorf("rebase continue timed out")
		}
		return fmt.Errorf("%s", strings.TrimSpace(outBuf.String()))
	}
	return nil
}

// AbortRebase aborts the current interactive rebase and restores the original branch.
func (r *Repository) AbortRebase() error {
	_, err := CLI(r.Path, "rebase", "--abort")
	return err
}

// DetectRebaseState checks whether an interactive rebase is in progress by
// inspecting the .git/rebase-merge directory that git creates for interactive
// and merge-strategy rebases.
// Returns nil when no rebase is in progress.
func (r *Repository) DetectRebaseState(conflictCount int) *RebaseState {
	gitDir := r.gitDir()
	mergeDir := filepath.Join(gitDir, "rebase-merge")
	if _, err := os.Stat(mergeDir); err != nil {
		return nil
	}

	state := &RebaseState{InProgress: true, ConflictCount: conflictCount}

	// Branch being rebased.
	if data, err := os.ReadFile(filepath.Join(mergeDir, "head-name")); err == nil {
		name := strings.TrimSpace(string(data))
		state.HeadName = strings.TrimPrefix(name, "refs/heads/")
	}

	// Base commit (onto).
	if data, err := os.ReadFile(filepath.Join(mergeDir, "onto")); err == nil {
		onto := strings.TrimSpace(string(data))
		state.Onto = r.hashToFriendlyName(onto)
	}

	// Step / total progress counters.
	if data, err := os.ReadFile(filepath.Join(mergeDir, "msgnum")); err == nil {
		fmt.Sscanf(strings.TrimSpace(string(data)), "%d", &state.Step)
	}
	if data, err := os.ReadFile(filepath.Join(mergeDir, "end")); err == nil {
		fmt.Sscanf(strings.TrimSpace(string(data)), "%d", &state.Total)
	}

	return state
}

// CommitsOnRemote returns the subset of hashes from the input that are already
// present on the upstream remote tracking branch (i.e. have been pushed).
// Returns nil if no upstream is configured — treat all commits as unpushed.
func (r *Repository) CommitsOnRemote(hashes []string) ([]string, error) {
	if len(hashes) == 0 {
		return nil, nil
	}

	// Commits ahead of upstream = not yet pushed.
	// @{upstream} resolves to the remote tracking branch of the current branch.
	out, err := CLI(r.Path, "log", "--format=%H", "@{upstream}..HEAD")
	if err != nil {
		// No upstream configured → assume everything is local.
		return nil, nil
	}

	localOnly := make(map[string]bool)
	for _, h := range strings.Fields(out) {
		localOnly[h] = true
	}

	var pushed []string
	for _, h := range hashes {
		if !localOnly[h] {
			pushed = append(pushed, h)
		}
	}
	return pushed, nil
}
