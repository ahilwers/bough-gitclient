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
	"crypto/rand"
	"errors"
	gitpkg "gitmorrow/git"
	"os"
	"sync"
	"time"
)

// Info contains safe metadata only. IDs refer to bounded, short-lived backend data.
type Info struct {
	ID        string `json:"id"`
	Operation string `json:"operation"`
	ExitCode  int    `json:"exitCode"`
	Category  string `json:"category"`
}
type transient struct {
	info      Info
	raw       string
	expires   time.Time
	timer     *time.Timer
	displayed bool
}
type Service struct {
	mu        sync.Mutex
	retention time.Duration
	log       *Logger
	entries   map[string]transient
}

func NewService(dir string) *Service { return newService(dir, 5*time.Minute) }
func newService(dir string, retention time.Duration) *Service {
	l := New(dir)
	if l.root != nil {
		if _, err := l.root.Lstat("logging-disabled"); err == nil {
			l.disable("disabled")
		} else if !os.IsNotExist(err) {
			l.disable("protection")
		}
	}
	return &Service{log: l, retention: retention, entries: make(map[string]transient)}
}

type Status struct {
	Enabled bool   `json:"enabled"`
	Reason  string `json:"reason"`
}

func (s *Service) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.log.mu.Lock()
	defer s.log.mu.Unlock()
	return Status{s.log.file != nil, s.log.reason}
}
func (s *Service) SetEnabled(enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	l := s.log
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.root == nil {
		return errProtection
	}
	if !enabled {
		file, err := l.openLog("logging-disabled", false)
		if err != nil {
			return errProtection
		}
		file.Close()
		l.disable("disabled")
		return nil
	}
	if err := l.root.Remove("logging-disabled"); err != nil && !os.IsNotExist(err) {
		return errProtection
	}
	if l.file == nil {
		var err error
		l.file, err = l.openLog("agent.log", false)
		if err != nil {
			l.reason = "protection"
			return errProtection
		}
	}
	l.reason = ""
	return nil
}
func (s *Service) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, entry := range s.entries {
		entry.timer.Stop()
	}
	s.entries = make(map[string]transient)
	s.log.Close()
}
func (s *Service) Capture(err error) *Info {
	var f *gitpkg.Failure
	if !errors.As(err, &f) {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prune()
	if len(s.entries) >= 10 {
		for id := range s.entries {
			s.entries[id].timer.Stop()
			delete(s.entries, id)
			break
		}
	}
	info := Info{rand.Text(), f.Operation, f.ExitCode, f.Category}
	timer := time.AfterFunc(s.retention, func() { s.mu.Lock(); defer s.mu.Unlock(); delete(s.entries, info.ID) })
	s.entries[info.ID] = transient{info, f.Diagnostic(), time.Now().Add(s.retention), timer, false}
	return &info
}

// Display acknowledges a notification actually shown by the frontend. Merely
// returning a rejected IPC call is not enough: queries can retry or swallow it.
func (s *Service) Display(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prune()
	entry, ok := s.entries[id]
	if !ok || entry.displayed {
		return
	}
	entry.displayed = true
	s.entries[id] = entry
	s.log.Record(entry.info.Operation, entry.info.ExitCode, entry.info.Category)
}
func (s *Service) prune() {
	for id, entry := range s.entries {
		if time.Now().After(entry.expires) {
			entry.timer.Stop()
			delete(s.entries, id)
		}
	}
}
func (s *Service) Get(id string) *Info {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prune()
	entry, ok := s.entries[id]
	if !ok {
		return nil
	}
	return &entry.info
}

// Copy passes raw data only to the native clipboard callback after explicit
// warning acknowledgement. Failed writes preserve the original expiry and data.
func (s *Service) Copy(id string, confirmed bool, write func(string) bool) error {
	if !confirmed {
		return errors.New("explicit confirmation required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.prune()
	entry, ok := s.entries[id]
	if !ok || entry.raw == "" {
		return errors.New("diagnostic expired or already copied")
	}
	if write == nil || !write(entry.raw) {
		return errors.New("clipboard unavailable")
	}
	entry.raw = ""
	s.entries[id] = entry
	return nil
}
