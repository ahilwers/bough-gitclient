package git

import (
	"strings"
	"testing"
)

func TestBranchDeletionDestinationRedaction(t *testing.T) {
	first := safeDestination("origin", "https://alice:password@example.com:8443/secret-path?token=secret-query#secret-fragment")
	second := safeDestination("origin", "https://alice:password@example.com:8443/another-secret-path?token=secret-query#secret-fragment")
	if first == second {
		t.Fatal("different repositories on one host have identical destination labels")
	}
	if first != safeDestination("origin", "https://alice:password@example.com:8443/secret-path?token=secret-query#secret-fragment") {
		t.Fatal("destination ID is not stable")
	}
	for _, label := range []string{first, second} {
		if !strings.Contains(label, "example.com:8443") || !strings.Contains(label, "push URL SHA-256:") {
			t.Fatalf("missing host, port, or URL fingerprint explanation: %q", label)
		}
		for _, secret := range []string{"alice", "password", "secret-path", "secret-query", "secret-fragment"} {
			if strings.Contains(label, secret) {
				t.Fatalf("secret %q exposed in %q", secret, label)
			}
		}
	}
	ssh := safeDestination("origin", "private-user@example.com:private-path/repo.git")
	if strings.Contains(ssh, "private-user") || strings.Contains(ssh, "private-path") || !strings.Contains(ssh, "example.com") {
		t.Fatalf("unsafe SSH destination: %q", ssh)
	}
}
