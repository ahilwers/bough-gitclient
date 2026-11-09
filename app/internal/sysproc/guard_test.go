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

package sysproc

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
)

// moduleRoot is the module directory (app/) relative to this package.
const moduleRoot = "../.."

// ignoredDirs hold generated, vendored or binary output that never contains
// hand-written process code.
var ignoredDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	"bin":          true,
	"build":        true,
	"dist":         true,
}

// TestNoDirectExecCommand guards the rule that production code must create
// child processes with Command or CommandContext. A direct exec.Command call
// forgets CREATE_NO_WINDOW and makes a console window flash on Windows during
// every Git action, so it must fail here instead of in manual testing.
// Test files are exempt: they run in a console and need no wrapper.
func TestNoDirectExecCommand(t *testing.T) {
	selfDir, err := filepath.Abs(".")
	if err != nil {
		t.Fatalf("resolve package dir: %v", err)
	}

	var offenses []string
	moduleAbs, err := filepath.Abs(moduleRoot)
	if err != nil {
		t.Fatalf("resolve module root: %v", err)
	}
	walkErr := filepath.WalkDir(moduleRoot, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			if path != moduleRoot && (ignoredDirs[entry.Name()] || strings.HasPrefix(entry.Name(), ".")) {
				return fs.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		abs, err := filepath.Abs(path)
		if err != nil {
			return err
		}
		if strings.HasPrefix(abs, selfDir+string(filepath.Separator)) {
			return nil // this package is the wrapper itself
		}
		rel, err := filepath.Rel(moduleAbs, abs)
		if err != nil {
			return err
		}
		offenses = append(offenses, directExecCalls(t, path, filepath.Join(filepath.Base(moduleAbs), rel))...)
		return nil
	})
	if walkErr != nil {
		t.Fatalf("walk %s: %v", moduleRoot, walkErr)
	}

	if len(offenses) > 0 {
		t.Errorf("use sysproc.Command or sysproc.CommandContext instead of exec.Command/exec.CommandContext, "+
			"otherwise Windows opens a console window for each child process:\n\t%s",
			strings.Join(offenses, "\n\t"))
	}
}

// directExecCalls reports calls to os/exec's Command or CommandContext in the
// given file. Comments and strings are ignored because the source is parsed.
// displayPath is used in messages so the offense points at the repository file.
func directExecCalls(t *testing.T, path, displayPath string) []string {
	t.Helper()
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, nil, parser.SkipObjectResolution)
	if err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}

	// Local names under which os/exec is imported, including aliases.
	execNames := map[string]bool{}
	for _, imp := range file.Imports {
		if strings.Trim(imp.Path.Value, `"`) != "os/exec" {
			continue
		}
		name := "exec"
		if imp.Name != nil {
			name = imp.Name.Name
		}
		execNames[name] = true
	}
	if len(execNames) == 0 {
		return nil
	}

	var offenses []string
	ast.Inspect(file, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		sel, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		if ident, ok := sel.X.(*ast.Ident); ok && execNames[ident.Name] &&
			(sel.Sel.Name == "Command" || sel.Sel.Name == "CommandContext") {
			offenses = append(offenses, fmt.Sprintf("%s:%d", displayPath, fset.Position(call.Pos()).Line))
		}
		return true
	})
	return offenses
}
