package git

import (
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// Watcher monitors one or more repository paths and fires a callback
// when the .git directory changes (new commits, branch switches, etc.).
type Watcher struct {
	watcher   *fsnotify.Watcher
	callbacks []func(path string)
	mu        sync.Mutex
}

func NewWatcher() (*Watcher, error) {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	w := &Watcher{watcher: fw}
	go w.loop()
	return w, nil
}

// Watch adds a repository path to the watch list.
func (w *Watcher) Watch(repoPath string) error {
	gitDir := filepath.Join(repoPath, ".git")
	return w.watcher.Add(gitDir)
}

// Unwatch removes a path from the watch list.
func (w *Watcher) Unwatch(repoPath string) error {
	gitDir := filepath.Join(repoPath, ".git")
	return w.watcher.Remove(gitDir)
}

// OnChange registers a callback that fires when any watched path changes.
func (w *Watcher) OnChange(fn func(path string)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.callbacks = append(w.callbacks, fn)
}

func (w *Watcher) loop() {
	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			// Only fire on changes to key files that signal meaningful git state changes
			base := filepath.Base(event.Name)
			if base == "HEAD" || base == "index" || base == "COMMIT_EDITMSG" || base == "packed-refs" {
				w.mu.Lock()
				cbs := make([]func(string), len(w.callbacks))
				copy(cbs, w.callbacks)
				w.mu.Unlock()
				repoPath := filepath.Dir(filepath.Dir(event.Name))
				for _, cb := range cbs {
					go cb(repoPath)
				}
			}
		case _, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
		}
	}
}

func (w *Watcher) Close() {
	w.watcher.Close()
}
