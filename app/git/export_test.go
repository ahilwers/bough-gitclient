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

// ParseWorktreesForTest exposes the unexported parseWorktrees function
// for use by the external test package (package git_test).
// This file is only compiled into test binaries.
func ParseWorktreesForTest(output string) []WorktreeInfo {
	return parseWorktrees(output)
}
