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
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

const watcherDebounce = 400 * time.Millisecond

// indexQuietWindow is how long after a status/staging call we suppress index
// events. git status refreshes the stat cache in .git/index on every run; this
// window breaks the resulting feedback loop while still letting external
// "git add" calls through.
const indexQuietWindow = 2 * time.Second

// Watcher monitors one or more repository paths and fires a callback
// when the .git directory changes (new commits, branch switches, etc.).
type Watcher struct {
	watcher   *fsnotify.Watcher
	callbacks []func(path string)
	mu        sync.Mutex

	// debounce state — collapses bursts of events into a single fire
	debounceMu sync.Mutex
	timer      *time.Timer
	pending    string

	// lastStatusCall tracks when we last ran git status so index events that
	// arrive within indexQuietWindow are suppressed (feedback-loop guard).
	lastStatusMu   sync.Mutex
	lastStatusCall time.Time
}

func NewWatcher() (*Watcher, error) {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	w := &Watcher{watcher: fw}
	go w.loop()
	return w, nil
}

// Watch adds a repository path to the watch list.
func (w *Watcher) Watch(repoPath string) error {
	gitDir := filepath.Join(repoPath, ".git")
	return w.watcher.Add(gitDir)
}

// Unwatch removes a path from the watch list.
func (w *Watcher) Unwatch(repoPath string) error {
	gitDir := filepath.Join(repoPath, ".git")
	return w.watcher.Remove(gitDir)
}

// OnChange registers a callback that fires when any watched path changes.
func (w *Watcher) OnChange(fn func(path string)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.callbacks = append(w.callbacks, fn)
}

// MarkStatusCall records the current time so that index events arriving
// within indexQuietWindow are suppressed. Call this immediately before
// running git status or any staging operation.
func (w *Watcher) MarkStatusCall() {
	w.lastStatusMu.Lock()
	w.lastStatusCall = time.Now()
	w.lastStatusMu.Unlock()
}

func (w *Watcher) isIndexQuiet() bool {
	w.lastStatusMu.Lock()
	defer w.lastStatusMu.Unlock()
	return time.Since(w.lastStatusCall) < indexQuietWindow
}

func (w *Watcher) loop() {
	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			base := filepath.Base(event.Name)
			switch base {
			case "HEAD", "COMMIT_EDITMSG", "packed-refs":
				// Git ref changes — always fire immediately.
			case "index":
				// Staging-area changes: fire only when the write was not caused
				// by our own status call (feedback-loop guard).
				if w.isIndexQuiet() {
					continue
				}
			default:
				continue
			}
			repoPath := filepath.Dir(filepath.Dir(event.Name))
			w.scheduleFireDebounced(repoPath)

		case _, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
		}
	}
}

// scheduleFireDebounced resets (or starts) the debounce timer.
// All events within watcherDebounce of each other are collapsed into one callback.
func (w *Watcher) scheduleFireDebounced(repoPath string) {
	w.debounceMu.Lock()
	defer w.debounceMu.Unlock()

	w.pending = repoPath
	if w.timer != nil {
		w.timer.Reset(watcherDebounce)
		return
	}
	w.timer = time.AfterFunc(watcherDebounce, func() {
		w.debounceMu.Lock()
		path := w.pending
		w.timer = nil
		w.debounceMu.Unlock()

		w.mu.Lock()
		cbs := make([]func(string), len(w.callbacks))
		copy(cbs, w.callbacks)
		w.mu.Unlock()

		for _, cb := range cbs {
			go cb(path)
		}
	})
}

func (w *Watcher) Close() {
	w.watcher.Close()
}
