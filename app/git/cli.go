package git

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"time"
)

// cliTimeout is the maximum time a single git subprocess may run.
// Any command that exceeds this is killed and returns an error.
// 15 seconds is generous for all local operations; hung credential
// prompts or index-lock contention are cut off before they freeze the UI.
const cliTimeout = 15 * time.Second

// CLI runs a git command and returns stdout as a string.
// It always completes within cliTimeout, returning an error if the deadline
// is exceeded so callers never block the IPC handler goroutine indefinitely.
// Empty args are silently ignored (useful for conditional flags).
func CLI(dir string, args ...string) (string, error) {
	filtered := make([]string, 0, len(args))
	for _, a := range args {
		if a != "" {
			filtered = append(filtered, a)
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), cliTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", filtered...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return "", fmt.Errorf("git %v: timed out after %s", filtered, cliTimeout)
		}
		return "", fmt.Errorf("git %v: %w\n%s", filtered, err, stderr.String())
	}
	return stdout.String(), nil
}

// execGit creates an exec.Cmd for git without running it.
// Use this when you need to control Stdin or stream output.
func execGit(dir string, args ...string) *exec.Cmd {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	return cmd
}
