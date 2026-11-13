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
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/windows"
)

// These tests must run on Windows; cross-compilation is not ACL verification.
func TestWindowsProtectedACL(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "logs")
	l := New(dir)
	defer l.Close()
	if l.file == nil {
		t.Fatalf("protection unavailable: %s", l.reason)
	}
	user, err := windows.GetCurrentProcessToken().GetTokenUser()
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{".", "agent.log"} {
		f, err := l.root.Open(name)
		if err != nil {
			t.Fatal(err)
		}
		err = verifyACL(windows.Handle(f.Fd()), user.User.Sid, name == ".")
		f.Close()
		if err != nil {
			t.Fatal(err)
		}
	}
	// A broad DACL must be rejected by verification, not accepted because chmod worked.
	sd, err := windows.SecurityDescriptorFromString("D:P(A;;FA;;;WD)")
	if err != nil {
		t.Fatal(err)
	}
	acl, _, _ := sd.DACL()
	path, _ := windows.UTF16PtrFromString(filepath.Join(dir, "agent.log"))
	h, err := windows.CreateFile(path, windows.WRITE_DAC|windows.READ_CONTROL, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE, nil, windows.OPEN_EXISTING, 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer windows.CloseHandle(h)
	if err := windows.SetSecurityInfo(h, windows.SE_FILE_OBJECT, windows.DACL_SECURITY_INFORMATION|windows.PROTECTED_DACL_SECURITY_INFORMATION, nil, nil, acl, nil); err != nil {
		t.Fatal(err)
	}
	if verifyACL(h, user.User.Sid, false) == nil {
		t.Fatal("broad ACL accepted")
	}
}
func TestWindowsHardlinkRefused(t *testing.T) {
	base := t.TempDir()
	dir := filepath.Join(base, "logs")
	os.Mkdir(dir, 0700)
	target := filepath.Join(base, "victim")
	os.WriteFile(target, []byte("unchanged"), 0600)
	if err := os.Link(target, filepath.Join(dir, "agent.log")); err != nil {
		t.Fatal(err)
	}
	l := New(dir)
	defer l.Close()
	if l.file != nil {
		t.Fatal("hardlink accepted")
	}
}
