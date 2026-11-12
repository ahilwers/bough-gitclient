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

//go:build !windows

package diagnostics

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRefuseUnsafeTargets(t *testing.T) {
	for _, kind := range []string{"symlink", "hardlink", "directory", "ancestor"} {
		t.Run(kind, func(t *testing.T) {
			base := t.TempDir()
			dir := filepath.Join(base, "logs")
			os.Mkdir(dir, 0700)
			victim := filepath.Join(base, "victim")
			os.WriteFile(victim, []byte("unchanged"), 0600)
			target := filepath.Join(dir, "agent.log")
			switch kind {
			case "symlink":
				os.Symlink(victim, target)
			case "hardlink":
				os.Link(victim, target)
			case "directory":
				os.Mkdir(target, 0700)
			case "ancestor":
				os.Remove(dir)
				os.Symlink(base, dir)
			}
			l := New(dir)
			defer l.Close()
			l.Record("push", 1, "unknown")
			if l.reason != "protection" {
				t.Fatalf("did not fail closed: %q", l.reason)
			}
			data, _ := os.ReadFile(victim)
			if string(data) != "unchanged" {
				t.Fatal("victim modified")
			}
		})
	}
}
func TestPrivateModes(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	os.Mkdir(dir, 0755)
	l := New(dir)
	defer l.Close()
	l.Record("push", 1, "unknown")
	for path, want := range map[string]os.FileMode{dir: 0700, filepath.Join(dir, "agent.log"): 0600} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm() != want {
			t.Fatalf("permissions %s: %o", path, info.Mode().Perm())
		}
	}
}
