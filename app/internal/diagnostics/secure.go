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

package diagnostics

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
)

var errProtection = errors.New("protected storage unavailable")

// Walk with rooted directory handles: do not follow links in the selected path.
// The final handle remains open during writes and rotation.
func protectedRoot(path string) (*os.Root, error) {
	if !filepath.IsAbs(path) {
		return nil, errProtection
	}
	volume := filepath.VolumeName(path)
	root, err := os.OpenRoot(volume + string(os.PathSeparator))
	if err != nil {
		return nil, err
	}
	parts := strings.FieldsFunc(strings.TrimPrefix(path, volume), func(r rune) bool { return r == '/' || r == '\\' })
	for _, part := range parts {
		info, e := root.Lstat(part)
		if os.IsNotExist(e) {
			e = root.Mkdir(part, 0700)
			if e == nil {
				info, e = root.Lstat(part)
			}
		}
		if e != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
			root.Close()
			return nil, errProtection
		}
		next, e := root.OpenRoot(part)
		root.Close()
		if e != nil {
			return nil, e
		}
		// Pin identity across the lstat/open pair. Root prevents escapes, while
		// this comparison also rejects replacement with a different in-tree directory.
		opened, openErr := next.Open(".")
		if openErr != nil {
			next.Close()
			return nil, errProtection
		}
		actual, statErr := opened.Stat()
		opened.Close()
		if statErr != nil || !os.SameFile(info, actual) {
			next.Close()
			return nil, errProtection
		}
		root = next
	}
	dir, err := root.Open(".")
	if err == nil {
		err = protect(dir, true)
		dir.Close()
	}
	if err != nil {
		root.Close()
		return nil, err
	}
	return root, nil
}

func (l *Logger) openLog(name string, exclusive bool) (*os.File, error) {
	before, statErr := l.root.Lstat(name)
	if statErr == nil {
		if !before.Mode().IsRegular() {
			return nil, errProtection
		}
	} else if !os.IsNotExist(statErr) {
		return nil, statErr
	}
	flags := os.O_CREATE | os.O_APPEND | os.O_WRONLY | noFollow
	if exclusive || os.IsNotExist(statErr) {
		flags |= os.O_EXCL
	}
	file, err := l.root.OpenFile(name, flags, 0600)
	if err != nil {
		return nil, err
	}
	if err = protect(file, false); err == nil {
		info, statErr := file.Stat()
		if statErr != nil {
			err = statErr
		} else if (before != nil && !os.SameFile(before, info)) || info.Size() > 2*1024*1024 {
			err = errProtection
		}
	}
	if err != nil {
		file.Close()
		return nil, err
	}
	return file, nil
}
