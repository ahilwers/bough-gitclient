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

// Package sysproc creates child processes for the GUI application.
//
// Windows allocates a new console window for every console program (git, ssh,
// credential helpers) that a GUI process starts. GitMorrow must therefore create
// all child processes through this package, which suppresses that window. The
// suppression is a no-op on macOS and Linux.
//
// Callers must use Command and CommandContext instead of the os/exec
// originals; TestNoDirectExecCommand enforces this for production code.
package sysproc

import (
	"context"
	"os/exec"
)

// Command is exec.Command with the console window suppressed on Windows.
// Use it for every child process instead of exec.Command.
func Command(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	hideWindow(cmd)
	return cmd
}

// CommandContext is exec.CommandContext with the console window suppressed on
// Windows. Use it for every child process instead of exec.CommandContext.
func CommandContext(ctx context.Context, name string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, name, args...)
	hideWindow(cmd)
	return cmd
}
