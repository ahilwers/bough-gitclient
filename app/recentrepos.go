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

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const maxRecentRepos = 10

func recentReposPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "GitMorrow", "recent_repos.json"), nil
}

func loadRecentRepos() []string {
	path, err := recentReposPath()
	if err != nil {
		return nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var repos []string
	if err := json.Unmarshal(data, &repos); err != nil {
		return nil
	}
	return repos
}

func saveRecentRepos(repos []string) error {
	path, err := recentReposPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.Marshal(repos)
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

// addRecentRepo prepends repoPath to the persisted list, deduplicates, and
// caps it at maxRecentRepos. Returns the updated list.
func addRecentRepo(repoPath string) []string {
	existing := loadRecentRepos()
	result := make([]string, 0, len(existing)+1)
	result = append(result, repoPath)
	for _, r := range existing {
		if r != repoPath {
			result = append(result, r)
		}
	}
	if len(result) > maxRecentRepos {
		result = result[:maxRecentRepos]
	}
	return result
}
