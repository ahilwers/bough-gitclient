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

package sysproc

import (
	"os/exec"
	"testing"
)

func TestCommandDoesNotTouchSysProcAttr(t *testing.T) {
	for name, cmd := range map[string]*exec.Cmd{
		"Command":        Command("git", "--version"),
		"CommandContext": CommandContext(t.Context(), "git", "--version"),
	} {
		if cmd.SysProcAttr != nil {
			t.Errorf("%s: SysProcAttr = %+v, want nil on this platform", name, cmd.SysProcAttr)
		}
	}
}
