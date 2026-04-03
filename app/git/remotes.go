package git

import (
	"strings"
)

// ListRemotes returns all configured remotes with their fetch and push URLs.
func (r *Repository) ListRemotes() ([]Remote, error) {
	out, err := CLI(r.Path, "remote", "-v")
	if err != nil {
		// "git remote -v" exits 0 even with no remotes, but handle errors gracefully
		return []Remote{}, nil
	}
	return parseRemoteVerbose(out), nil
}

// parseRemoteVerbose parses "git remote -v" output into Remote structs.
// Each remote appears twice (fetch + push); we collapse them into one entry.
func parseRemoteVerbose(out string) []Remote {
	type entry struct {
		fetchURL string
		pushURL  string
	}
	seen := make(map[string]*entry)
	var order []string

	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// "origin\thttps://github.com/user/repo.git (fetch)"
		tab := strings.IndexByte(line, '\t')
		if tab < 0 {
			continue
		}
		name := line[:tab]
		rest := line[tab+1:]

		var url, kind string
		if idx := strings.LastIndex(rest, " ("); idx >= 0 {
			url = rest[:idx]
			kind = strings.Trim(rest[idx+2:], "()")
		} else {
			url = rest
		}

		if _, ok := seen[name]; !ok {
			seen[name] = &entry{}
			order = append(order, name)
		}
		if kind == "push" {
			seen[name].pushURL = url
		} else {
			seen[name].fetchURL = url
		}
	}

	result := make([]Remote, 0, len(order))
	for _, name := range order {
		e := seen[name]
		pushURL := e.pushURL
		if pushURL == "" {
			pushURL = e.fetchURL
		}
		result = append(result, Remote{
			Name:     name,
			FetchURL: e.fetchURL,
			PushURL:  pushURL,
		})
	}
	return result
}

// AddRemote adds a new remote with the given name and URL.
func (r *Repository) AddRemote(name, url string) error {
	_, err := CLI(r.Path, "remote", "add", name, url)
	return err
}

// UpdateRemote changes the URL of an existing remote.
func (r *Repository) UpdateRemote(name, url string) error {
	_, err := CLI(r.Path, "remote", "set-url", name, url)
	return err
}

// RenameRemote renames an existing remote.
func (r *Repository) RenameRemote(oldName, newName string) error {
	_, err := CLI(r.Path, "remote", "rename", oldName, newName)
	return err
}

// RemoveRemote removes a remote by name.
func (r *Repository) RemoveRemote(name string) error {
	_, err := CLI(r.Path, "remote", "remove", name)
	return err
}
