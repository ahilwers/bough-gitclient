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
	"errors"
	gitpkg "gitmorrow/git"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCopyRetriesFailedClipboardWithoutExtendingExpiry(t *testing.T) {
	s := NewService(filepath.Join(t.TempDir(), "logs"))
	defer s.Close()
	copier, ok := any(s).(interface {
		Copy(string, bool, func(string) bool) error
	})
	if !ok {
		t.Fatal("service lacks nondestructive native clipboard copy")
	}
	_, failure := gitpkg.CLI(t.TempDir(), "show", "secret-token")
	info := s.Capture(failure)
	expires := s.entries[info.ID].expires
	writes := 0
	write := func(raw string) bool {
		writes++
		if raw == "" {
			t.Fatal("missing clipboard content")
		}
		return false
	}
	if err := copier.Copy(info.ID, false, write); err == nil || err.Error() != "explicit confirmation required" {
		t.Fatal("missing safe confirmation error")
	}
	if writes != 0 {
		t.Fatal("clipboard called without consent")
	}
	if err := copier.Copy(info.ID, true, write); err == nil || err.Error() != "clipboard unavailable" {
		t.Fatal("missing safe clipboard failure")
	}
	if !s.entries[info.ID].expires.Equal(expires) {
		t.Fatal("failed copy extended expiry")
	}
	if err := copier.Copy(info.ID, true, func(raw string) bool { writes++; return raw != "" }); err != nil {
		t.Fatal(err)
	}
	if writes != 2 {
		t.Fatal("failed copy was not retryable")
	}
	if err := copier.Copy(info.ID, true, write); err == nil || err.Error() != "diagnostic expired or already copied" {
		t.Fatal("successful copy not consumed")
	}
	if writes != 2 {
		t.Fatal("consumed data copied again")
	}

	info = s.Capture(failure)
	if err := copier.Copy(info.ID, true, nil); err == nil {
		t.Fatal("nil clipboard accepted")
	}
	entry := s.entries[info.ID]
	entry.expires = time.Now().Add(-time.Second)
	s.entries[info.ID] = entry
	if err := copier.Copy(info.ID, true, write); err == nil {
		t.Fatal("failed copy survived original expiry")
	}
	if writes != 2 {
		t.Fatal("expired data reached clipboard")
	}
}

func TestIdleDiagnosticsExpire(t *testing.T) {
	s := newService(filepath.Join(t.TempDir(), "logs"), 10*time.Millisecond)
	defer s.Close()
	_, failure := gitpkg.CLI(t.TempDir(), "show", "secret-token")
	s.Capture(failure)
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
		s.mu.Lock()
		count := len(s.entries)
		s.mu.Unlock()
		if count == 0 {
			return
		}
	}
	t.Fatal("idle raw output did not expire")
}

func TestTransientCacheIsBoundedAndExpires(t *testing.T) {
	s := NewService(filepath.Join(t.TempDir(), "logs"))
	defer s.Close()
	_, failure := gitpkg.CLI(t.TempDir(), "show", "secret-token")
	for i := 0; i < 30; i++ {
		s.Capture(failure)
	}
	if len(s.entries) != 10 {
		t.Fatalf("cache size %d", len(s.entries))
	}
	var id string
	for key := range s.entries {
		id = key
		break
	}
	entry := s.entries[id]
	entry.expires = time.Now().Add(-time.Second)
	s.entries[id] = entry
	if s.Get(id) != nil || s.Copy(id, true, func(string) bool { t.Fatal("expired data copied"); return true }) == nil {
		t.Fatal("expired output retained")
	}
}

func TestDisabledSettingPersists(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	s := NewService(dir)
	if !s.Status().Enabled {
		t.Fatal("not enabled by default")
	}
	if err := s.SetEnabled(false); err != nil {
		t.Fatal(err)
	}
	s.Close()
	s = NewService(dir)
	defer s.Close()
	if s.Status().Enabled || s.Status().Reason != "disabled" {
		t.Fatal("setting not persisted")
	}
	_, failure := gitpkg.CLI(t.TempDir(), "show", "secret-token")
	s.Display(s.Capture(failure).ID)
	data, _ := os.ReadFile(filepath.Join(dir, "agent.log"))
	if len(data) != 0 {
		t.Fatal("logged while disabled")
	}
	if err := s.SetEnabled(true); err != nil {
		t.Fatal(err)
	}
	s.Display(s.Capture(failure).ID)
	data, _ = os.ReadFile(filepath.Join(dir, "agent.log"))
	if len(data) == 0 {
		t.Fatal("logging did not resume")
	}
}

func TestOnlySurfacedFailuresAreRecorded(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	s := NewService(dir)
	defer s.Close()
	_, probe := gitpkg.CLI(t.TempDir(), "show", "secret-token")
	data, _ := os.ReadFile(filepath.Join(dir, "agent.log"))
	if len(data) != 0 {
		t.Fatal("internal probe logged")
	}
	if s.Capture(errors.New("secret-token")) != nil {
		t.Fatal("unknown error classified")
	}
	info := s.Capture(probe)
	data, _ = os.ReadFile(filepath.Join(dir, "agent.log"))
	if len(data) != 0 {
		t.Fatal("returned but undisplayed IPC error logged")
	}
	s.Display(info.ID)
	s.Display(info.ID) // Rendering twice must not duplicate the record.
	if info == nil || info.Operation != "show" || info.ID == "" {
		t.Fatal("missing safe metadata")
	}
	data, _ = os.ReadFile(filepath.Join(dir, "agent.log"))
	if strings.Contains(string(data), "secret") || !strings.Contains(string(data), "show") {
		t.Fatalf("wrong log %s", data)
	}
	if s.Copy(info.ID, false, func(string) bool { t.Fatal("copy without consent"); return true }) == nil {
		t.Fatal("raw copied without explicit consent")
	}
	if s.Copy(info.ID, true, func(raw string) bool { return raw != "" }) != nil {
		t.Fatal("missing raw")
	}
	if s.Copy(info.ID, true, func(string) bool { t.Fatal("copy after consumption"); return true }) == nil {
		t.Fatal("raw retained after one-shot copy")
	}
}
