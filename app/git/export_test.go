package git

// ParseWorktreesForTest exposes the unexported parseWorktrees function
// for use by the external test package (package git_test).
// This file is only compiled into test binaries.
func ParseWorktreesForTest(output string) []WorktreeInfo {
	return parseWorktrees(output)
}
