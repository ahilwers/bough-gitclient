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
	"syscall"
)

const noFollow = syscall.O_NOFOLLOW

func lockWriter(file *os.File) error {
	return syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
}

func protect(file *os.File, directory bool) error {
	info, err := file.Stat()
	if err != nil {
		return err
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok || stat.Uid != uint32(os.Geteuid()) || (!directory && (stat.Nlink != 1 || !info.Mode().IsRegular())) || (directory && !info.IsDir()) {
		return errProtection
	}
	mode := os.FileMode(0600)
	if directory {
		mode = 0700
	}
	if err := file.Chmod(mode); err != nil {
		return err
	}
	info, err = file.Stat()
	if err != nil {
		return err
	}
	if info.Mode().Perm() != mode {
		return errProtection
	}
	return nil
}
