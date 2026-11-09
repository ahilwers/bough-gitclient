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
