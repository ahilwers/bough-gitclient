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

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// BranchDeletionInfo is the confirmation snapshot. OID is the local branch tip
// or the push destination's branch tip, not the remote-tracking tip. Destination
// contains a redacted label and a short hash identifying a complete network URL.
// ConfigFingerprint hashes the remote, fetch refspec, effective push/fetch URLs,
// tracking ref and its OID; it is empty for local branch deletion.
type BranchDeletionInfo struct {
	RepoPath          string `json:"repoPath"`
	Name              string `json:"name"`
	Remote            string `json:"remote"`
	Ref               string `json:"ref"`
	OID               string `json:"oid"`
	Destination       string `json:"destination"`
	ConfigFingerprint string `json:"configFingerprint"`
}

var deletionOID = regexp.MustCompile(`^(?:[0-9a-f]{40}|[0-9a-f]{64})$`)

// Do not return Git's raw diagnostics: they may include credentials from URLs,
// arbitrary server output, or command arguments. Classify useful failure types.
func remoteGit(dir string, args ...string) (string, error) {
	out, err := CLI(dir, args...)
	if err == nil {
		return out, nil
	}
	if IsAuthError(err) {
		return "", ErrAuthFailed
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "stale info") {
		return "", fmt.Errorf("remote branch changed; prepare deletion again")
	}
	if strings.Contains(msg, "rejected") || strings.Contains(msg, "denied") {
		return "", fmt.Errorf("remote server rejected branch deletion")
	}
	return "", fmt.Errorf("could not contact push destination or delete remote branch")
}

func safeDestination(remote, raw string) string {
	if filepath.IsAbs(raw) || strings.HasPrefix(raw, "./") || strings.HasPrefix(raw, "../") {
		return remote + " (" + raw + ")"
	}
	// The ID is a SHA-256 prefix of the complete effective push URL. Unlike
	// userinfo, paths, queries and fragments, it can distinguish destinations
	// without displaying credentials or secret-bearing repository paths.
	sum := sha256.Sum256([]byte(raw))
	id := hex.EncodeToString(sum[:6])
	if u, err := url.Parse(raw); err == nil && u.Scheme != "" && u.Hostname() != "" {
		return remote + " (" + u.Host + "; push URL SHA-256: " + id + ")"
	}
	if at := strings.LastIndexByte(raw, '@'); at >= 0 {
		rest := raw[at+1:]
		if colon := strings.IndexByte(rest, ':'); colon > 0 {
			return remote + " (" + rest[:colon] + "; push URL SHA-256: " + id + ")"
		}
	}
	return remote + " (push URL SHA-256: " + id + ")"
}

func branchDeletionFingerprint(remote, fetchRefspec, pushURL, fetchURLs, tracking, trackingOID string) string {
	config, _ := json.Marshal([]string{remote, fetchRefspec, pushURL, fetchURLs, tracking, trackingOID})
	sum := sha256.Sum256(config)
	return hex.EncodeToString(sum[:])
}

func deletionRefOID(dir, ref string) (string, error) {
	if _, err := CLI(dir, "symbolic-ref", "-q", ref); err == nil {
		return "", fmt.Errorf("symbolic branch refs cannot be deleted")
	}
	out, err := CLI(dir, "show-ref", "--verify", "--hash", ref)
	if err != nil {
		return "", fmt.Errorf("branch ref %q does not exist", ref)
	}
	oid := strings.TrimSpace(out)
	if !deletionOID.MatchString(oid) {
		return "", fmt.Errorf("invalid branch object ID")
	}
	return oid, nil
}

func (r *Repository) deletionWorktreePath() (string, error) {
	out, err := CLI(r.Path, "rev-parse", "--show-toplevel")
	if err != nil {
		return "", err
	}
	return filepath.Clean(strings.TrimSuffix(out, "\n")), nil
}

// PrepareBranchDeletion reads fresh refs and, for remotes, queries the actual
// push destination. Only the standard, unambiguous fetch mapping is supported.
func (r *Repository) PrepareBranchDeletion(name, remote string) (BranchDeletionInfo, error) {
	var info BranchDeletionInfo
	path, err := r.deletionWorktreePath()
	if err != nil {
		return info, err
	}
	info.RepoPath, info.Name, info.Remote = path, name, remote
	branch := name
	if remote != "" {
		if strings.Contains(remote, "/") || strings.HasPrefix(remote, "-") || !strings.HasPrefix(name, remote+"/") {
			return info, fmt.Errorf("invalid remote branch name")
		}
		branch = strings.TrimPrefix(name, remote+"/")
	}
	if branch == "" || strings.HasPrefix(branch, "-") || branch == "HEAD" {
		return info, fmt.Errorf("invalid branch name")
	}
	info.Ref = "refs/heads/" + branch
	if _, err := CLI(r.Path, "check-ref-format", info.Ref); err != nil {
		return info, fmt.Errorf("invalid branch name")
	}
	if remote == "" {
		info.OID, err = deletionRefOID(r.Path, info.Ref)
		info.Destination = "Local branch"
		return info, err
	}
	tracking := "refs/remotes/" + name
	trackingOID, err := deletionRefOID(r.Path, tracking)
	if err != nil {
		return info, err
	}
	// Reject rewrite rules: passing an already expanded URL back to Git could
	// otherwise rewrite it a second time, producing a different destination.
	if out, e := CLI(r.Path, "config", "--get-regexp", `^url\..*\.(insteadof|pushinsteadof)$`); e == nil {
		if out != "" {
			return info, fmt.Errorf("URL rewrite rules are not supported for branch deletion")
		}
	} else {
		var exit *exec.ExitError
		if !errors.As(e, &exit) || exit.ExitCode() != 1 {
			return info, fmt.Errorf("could not inspect URL rewrite rules")
		}
	}
	fetch, err := CLI(r.Path, "config", "--get-all", "remote."+remote+".fetch")
	if err != nil || strings.TrimSpace(fetch) != "+refs/heads/*:refs/remotes/"+remote+"/*" {
		return info, fmt.Errorf("remote fetch mapping is not the standard unambiguous branch mapping")
	}
	urls, err := CLI(r.Path, "remote", "get-url", "--push", "--all", "--", remote)
	if err != nil {
		return info, fmt.Errorf("configured remote has no push destination")
	}
	urlLines := strings.Split(strings.TrimSuffix(urls, "\n"), "\n")
	if len(urlLines) != 1 || urlLines[0] == "" || strings.HasPrefix(urlLines[0], "-") {
		return info, fmt.Errorf("remote must have exactly one push URL")
	}
	rawURL := urlLines[0]
	// An argument matching a remote name would make Git apply that remote's
	// push configuration instead of treating it as the confirmed URL.
	remotes, err := CLI(r.Path, "remote")
	if err != nil {
		return info, fmt.Errorf("could not inspect configured remotes")
	}
	for _, configured := range strings.Split(strings.TrimSpace(remotes), "\n") {
		if rawURL == configured {
			return info, fmt.Errorf("push destination conflicts with a configured remote name")
		}
	}
	// The effective fetch URLs identify the owner of the tracking ref. Include
	// them in the snapshot even when they differ from the push destination.
	fetchURLs, err := CLI(r.Path, "remote", "get-url", "--all", "--", remote)
	if err != nil {
		return info, fmt.Errorf("could not inspect remote fetch destinations")
	}
	info.Destination = safeDestination(remote, rawURL)
	info.ConfigFingerprint = branchDeletionFingerprint(remote, fetch, rawURL, fetchURLs, tracking, trackingOID)
	out, err := remoteGit(r.Path, "ls-remote", "--refs", "--", rawURL, info.Ref)
	if err != nil {
		return info, err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) != 1 {
		return info, fmt.Errorf("remote branch does not exist or is ambiguous")
	}
	parts := strings.Split(lines[0], "\t")
	if len(parts) != 2 || parts[1] != info.Ref || !deletionOID.MatchString(parts[0]) {
		return info, fmt.Errorf("remote branch does not exist or is ambiguous")
	}
	info.OID = parts[0]
	return info, nil
}

// DeleteBranch revalidates every snapshot field before deleting. Git itself
// checks worktree usage and merged status for local branches; the server checks
// the exact confirmed object ID atomically using a lease for remote branches.
func (r *Repository) DeleteBranch(info BranchDeletionInfo) error {
	path, err := r.deletionWorktreePath()
	if err != nil {
		return err
	}
	if path != info.RepoPath {
		return fmt.Errorf("repository changed; prepare deletion again")
	}
	current, err := r.PrepareBranchDeletion(info.Name, info.Remote)
	if err != nil {
		return err
	}
	if current != info {
		return fmt.Errorf("branch, repository, or remote configuration changed; prepare deletion again")
	}
	if info.Remote == "" {
		_, err = CLI(r.Path, "branch", "-d", "--", info.Name)
		return err
	}
	urls, err := CLI(r.Path, "remote", "get-url", "--push", "--all", "--", info.Remote)
	if err != nil {
		return fmt.Errorf("remote configuration changed; prepare deletion again")
	}
	lines := strings.Split(strings.TrimSuffix(urls, "\n"), "\n")
	if len(lines) != 1 || lines[0] == "" {
		return fmt.Errorf("remote configuration changed; prepare deletion again")
	}
	// Bind the concrete URL to the confirmed snapshot a second time.
	fetch, err := CLI(r.Path, "config", "--get-all", "remote."+info.Remote+".fetch")
	if err != nil {
		return fmt.Errorf("remote configuration changed; prepare deletion again")
	}
	tracking := "refs/remotes/" + info.Name
	trackingOID, err := deletionRefOID(r.Path, tracking)
	if err != nil {
		return err
	}
	fetchURLs, err := CLI(r.Path, "remote", "get-url", "--all", "--", info.Remote)
	if err != nil || branchDeletionFingerprint(info.Remote, fetch, lines[0], fetchURLs, tracking, trackingOID) != info.ConfigFingerprint {
		return fmt.Errorf("remote configuration changed; prepare deletion again")
	}
	// Git >= 2.56 keeps the remote-tracking branch in sync even when a delete
	// is pushed to a URL: it applies the fetch refspec of a uniquely matching
	// configured remote. That would drop a tracking ref we explicitly intend
	// to keep when the push and fetch destinations differ, and it would also
	// destroy a tracking ref refreshed concurrently during the push (the guard
	// for that is the deletion CAS below). Temporarily neutralise the fetch
	// mapping around the push so git cannot prune the tracking ref; the
	// explicit cleanup below remains the only authority over it.
	if _, e := CLI(r.Path, "config", "--unset-all", "remote."+info.Remote+".fetch"); e != nil {
		return fmt.Errorf("remote configuration changed; prepare deletion again")
	}
	_, err = remoteGit(r.Path, "push", "--no-mirror", "--no-tags", "--no-follow-tags", "--no-recurse-submodules", "--force-with-lease="+info.Ref+":"+info.OID, "--", lines[0], ":"+info.Ref)
	// Restore the fetch mapping no matter how the push ended. A remote without
	// a fetch refspec is broken for future operations.
	if _, re := CLI(r.Path, "config", "--add", "remote."+info.Remote+".fetch", strings.TrimSpace(fetch)); re != nil {
		return fmt.Errorf("remote configuration changed; prepare deletion again")
	}
	if err != nil {
		return err
	}
	// Tracking refs belong to the fetch destination. Clean up only for a
	// single effective fetch URL exactly equal to the confirmed push URL.
	// Recheck after the network operation; CAS and --no-deref protect refreshed
	// or newly symbolic tracking refs. Cleanup must not mask server success.
	fetchLines := strings.Split(strings.TrimSuffix(fetchURLs, "\n"), "\n")
	if len(fetchLines) == 1 && fetchLines[0] == lines[0] {
		if freshURLs, e := CLI(r.Path, "remote", "get-url", "--all", "--", info.Remote); e == nil && freshURLs == fetchURLs {
			_, _ = CLI(r.Path, "update-ref", "--no-deref", "-d", tracking, trackingOID)
		}
	}
	return nil
}
