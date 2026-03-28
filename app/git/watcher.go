package git

import (
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

const watcherDebounce = 400 * time.Millisecond

// Watcher monitors one or more repository paths and fires a callback
// when the .git directory changes (new commits, branch switches, etc.).
type Watcher struct {
	watcher   *fsnotify.Watcher
	callbacks []func(path string)
	mu        sync.Mutex

	// debounce state — collapses bursts of events into a single fire
	debounceMu sync.Mutex
	timer      *time.Timer
	pending    string
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
			// Only react to files that signal meaningful git state changes.
			// "index" is intentionally excluded: git status refreshes the stat
			// cache in .git/index on every run, which would create a feedback
			// loop (status → index write → watcher fires → status → ...).
			// Staging changes from our own UI are covered by query invalidation
			// in the mutation callbacks, so the watcher only needs to handle
			// external state changes (new commits, branch switches, remote ops).
			base := filepath.Base(event.Name)
			if base != "HEAD" && base != "COMMIT_EDITMSG" && base != "packed-refs" {
				continue
			}
			repoPath := filepath.Dir(filepath.Dir(event.Name))
			w.scheduleFireDebounced(repoPath)

		case _, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
		}
	}
}

// scheduleFireDebounced resets (or starts) the debounce timer.
// All events within watcherDebounce of each other are collapsed into one callback.
func (w *Watcher) scheduleFireDebounced(repoPath string) {
	w.debounceMu.Lock()
	defer w.debounceMu.Unlock()

	w.pending = repoPath
	if w.timer != nil {
		w.timer.Reset(watcherDebounce)
		return
	}
	w.timer = time.AfterFunc(watcherDebounce, func() {
		w.debounceMu.Lock()
		path := w.pending
		w.timer = nil
		w.debounceMu.Unlock()

		w.mu.Lock()
		cbs := make([]func(string), len(w.callbacks))
		copy(cbs, w.callbacks)
		w.mu.Unlock()

		for _, cb := range cbs {
			go cb(path)
		}
	})
}

func (w *Watcher) Close() {
	w.watcher.Close()
}
