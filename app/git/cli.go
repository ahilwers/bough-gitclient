package git

import (
	"bytes"
	"fmt"
	"os/exec"
)

// CLI runs a git command and returns stdout as a string.
// Empty args are ignored (useful for conditional flags).
func CLI(dir string, args ...string) (string, error) {
	filtered := make([]string, 0, len(args))
	for _, a := range args {
		if a != "" {
			filtered = append(filtered, a)
		}
	}
	cmd := execGit(dir, filtered...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %v: %w\n%s", filtered, err, stderr.String())
	}
	return stdout.String(), nil
}

// execGit creates an exec.Cmd for git without running it.
// Use this when you need to set Stdin or capture output separately.
func execGit(dir string, args ...string) *exec.Cmd {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	return cmd
}
