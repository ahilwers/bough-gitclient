package git

import (
	"bytes"
	"fmt"
	"os/exec"
)

// CLI runs a git command in the given working directory and returns stdout.
func CLI(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %v: %w\n%s", args, err, stderr.String())
	}
	return stdout.String(), nil
}
