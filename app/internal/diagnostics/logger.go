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
	"fmt"
	"os"
	"sync"
	"time"
)

type Logger struct {
	mu     sync.Mutex
	dir    string
	file   *os.File
	lock   *os.File
	root   *os.Root
	reason string
}

func New(dir string) *Logger {
	l := &Logger{dir: dir}
	var err error
	l.root, err = protectedRoot(dir)
	if err == nil {
		l.lock, err = l.openLog(".writer-lock", false)
	}
	if err == nil {
		err = lockWriter(l.lock)
	}
	if err == nil {
		// Establish protection and bounds for retained archives before enabling writes.
		for i := 1; i < 5; i++ {
			name := fmt.Sprintf("agent.log.%d", i)
			if _, statErr := l.root.Lstat(name); os.IsNotExist(statErr) {
				continue
			}
			var archive *os.File
			archive, err = l.openLog(name, false)
			if err != nil {
				break
			}
			archive.Close()
		}
	}
	if err == nil {
		l.file, err = l.openLog("agent.log", false)
	}
	if err != nil {
		l.reason = "protection"
		if l.lock != nil {
			l.lock.Close()
			l.lock = nil
		}
		if l.root != nil {
			l.root.Close()
			l.root = nil
		}
	}
	return l
}
func (l *Logger) Close() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.disable(l.reason)
	if l.lock != nil {
		l.lock.Close()
		l.lock = nil
	}
	if l.root != nil {
		l.root.Close()
		l.root = nil
	}
}
func (l *Logger) Record(op string, code int, category string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.file == nil {
		return
	}
	switch op {
	case "add", "restore", "apply", "stash", "pull", "push", "fetch", "rebase", "merge", "commit", "cherry-pick", "branch", "tag", "worktree", "checkout", "switch", "reset", "revert", "rm", "show", "diff", "config", "rev-parse", "ls-remote", "credential", "clone", "status", "log":
	default:
		op = "unknown"
	}
	switch category {
	case "authentication", "network", "locked", "rejected", "timeout", "cancelled", "already-exists":
	default:
		category = "unknown"
	}
	data, _ := json.Marshal(struct {
		Timestamp string `json:"timestamp"`
		Operation string `json:"operation"`
		ExitCode  int    `json:"exitCode"`
		Category  string `json:"category"`
	}{time.Now().UTC().Format(time.RFC3339), op, code, category})
	info, err := l.file.Stat()
	if err != nil {
		l.disable("storage")
		return
	}
	if info.Size()+int64(len(data)+1) > 2*1024*1024 {
		if err := l.rotate(); err != nil {
			l.disable("storage")
			return
		}
	}
	if _, err := l.file.Write(append(data, '\n')); err != nil {
		l.disable("storage")
	}
}

func (l *Logger) disable(reason string) {
	if l.file != nil {
		l.file.Close()
		l.file = nil
	}
	l.reason = reason
}
func (l *Logger) rotate() error {
	l.file.Close()
	l.file = nil
	name := func(i int) string {
		if i == 0 {
			return "agent.log"
		}
		return fmt.Sprintf("agent.log.%d", i)
	}
	// Validate every existing entry before rotation. Never alter a linked target.
	for i := 0; i < 5; i++ {
		if _, err := l.root.Lstat(name(i)); os.IsNotExist(err) {
			continue
		}
		file, err := l.openLog(name(i), false)
		if err != nil {
			return err
		}
		file.Close()
	}
	if err := l.root.Remove(name(4)); err != nil && !os.IsNotExist(err) {
		return err
	}
	for i := 3; i >= 0; i-- {
		if err := l.root.Rename(name(i), name(i+1)); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	var err error
	l.file, err = l.openLog(name(0), true)
	return err
}
