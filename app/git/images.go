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
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

// IsImageFile reports whether path looks like raster or vector image
// based on its file extension.
func IsImageFile(path string) bool {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp",
		".ico", ".tif", ".tiff", ".avif", ".heic", ".heif", ".svg":
		return true
	}
	return false
}

// mimeFromExt returns an image MIME type for the file extension. Binary
// images are sniffed by extension only (SVG is plain text but still an image).
func mimeFromExt(path string) string {
	switch strings.ToLower(filepath.Ext(path)) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".bmp":
		return "image/bmp"
	case ".ico":
		return "image/x-icon"
	case ".tif", ".tiff":
		return "image/tiff"
	case ".avif":
		return "image/avif"
	case ".heic", ".heif":
		return "image/heic"
	case ".svg":
		return "image/svg+xml"
	default:
		return "application/octet-stream"
	}
}

// dataURLFromBytes builds an ImageSource from raw bytes.
func dataURLFromBytes(path string, data []byte) ImageSource {
	encoded := base64.StdEncoding.EncodeToString(data)
	return ImageSource{
		DataURL: "data:" + mimeFromExt(path) + ";base64," + encoded,
		Size:    int64(len(data)),
	}
}

// bytesFromBlob reads all raw bytes of a blob.
func bytesFromBlob(blob *object.Blob) ([]byte, error) {
	reader, err := blob.Reader()
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}

// imageFromTree returns the image stored at filePath inside a tree.
func (r *Repository) imageFromTree(tree *object.Tree, filePath string) (ImageSource, error) {
	file, err := tree.File(filePath)
	if err != nil {
		return ImageSource{}, nil // file doesn't exist in this tree
	}
	data, err := bytesFromBlob(&file.Blob)
	if err != nil {
		return ImageSource{}, err
	}
	return dataURLFromBytes(filePath, data), nil
}

// GetImageAtCommit returns the image stored at filePath in the given commit
// as a base64 data URL. Returns an empty ImageSource (not an error) when the
// file did not exist at that commit.
func (r *Repository) GetImageAtCommit(hash, filePath string) (ImageSource, error) {
	commit, err := r.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return ImageSource{}, err
	}
	tree, err := commit.Tree()
	if err != nil {
		return ImageSource{}, err
	}
	return r.imageFromTree(tree, filePath)
}

// GetImageAtCommitParent returns the image stored at filePath in the first
// parent of hash. Returns an empty ImageSource when the commit has no parent
// or the file didn't exist in the parent.
func (r *Repository) GetImageAtCommitParent(hash, filePath string) (ImageSource, error) {
	commit, err := r.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return ImageSource{}, err
	}
	if len(commit.ParentHashes) == 0 {
		return ImageSource{}, nil
	}
	return r.GetImageAtCommit(commit.ParentHashes[0].String(), filePath)
}

// GetImageFromWorktree reads the current working-copy file as an image.
func (r *Repository) GetImageFromWorktree(filePath string) (ImageSource, error) {
	data, err := os.ReadFile(filepath.Join(r.Path, filePath))
	if err != nil {
		return ImageSource{}, err
	}
	return dataURLFromBytes(filePath, data), nil
}

// GetImageFromHead returns the image as stored in the current HEAD commit.
func (r *Repository) GetImageFromHead(filePath string) (ImageSource, error) {
	ref, err := r.repo.Head()
	if err != nil {
		return ImageSource{}, err
	}
	return r.GetImageAtCommit(ref.Hash().String(), filePath)
}

// GetImageFromIndex returns the image as stored in the git index (staged
// version). Returns an empty ImageSource when the path has no stage-0 entry
// (e.g. the file was staged for deletion or is not tracked).
func (r *Repository) GetImageFromIndex(filePath string) (ImageSource, error) {
	return r.getImageFromIndexStage(filePath, 0)
}

// mergeStageOurs selects the local (ours, stage 2) version during a merge.
const mergeStageOurs = 2

// mergeStageTheirs selects the incoming (theirs, stage 3) version during a merge.
const mergeStageTheirs = 3

// GetImageFromIndexStage returns the image bytes for the given merge stage in
// the index (0 = normal entry, 2 = ours, 3 = theirs during a merge).
func (r *Repository) GetImageFromIndexStage(filePath string, stage int) (ImageSource, error) {
	return r.getImageFromIndexStage(filePath, stage)
}

// getImageFromIndexStage returns the image bytes for the given merge stage in
// the index (0 = normal entry, 2 = ours, 3 = theirs during a merge).
func (r *Repository) getImageFromIndexStage(filePath string, stage int) (ImageSource, error) {
	idx, err := r.repo.Storer.Index()
	if err != nil {
		return ImageSource{}, err
	}
	for i := range idx.Entries {
		entry := idx.Entries[i]
		if entry.Name != filePath || int(entry.Stage) != stage {
			continue
		}
		blob, err := r.repo.BlobObject(entry.Hash)
		if err != nil {
			return ImageSource{}, err
		}
		data, err := bytesFromBlob(blob)
		if err != nil {
			return ImageSource{}, err
		}
		return dataURLFromBytes(filePath, data), nil
	}
	return ImageSource{}, nil
}

// stashCommitHash resolves stash@{index}^{commit} to its full hash.
func (r *Repository) stashCommitHash(index int) (string, error) {
	out, err := CLI(r.Path, "rev-parse", "--verify", fmt.Sprintf("stash@{%d}^{commit}", index))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out), nil
}

// GetImageFromStashBase returns the image at filePath in the commit the stash
// was based on (the stash's first parent). Empty when the file is untracked
// in the stash (only added by the stash itself) or the file didn't exist.
func (r *Repository) GetImageFromStashBase(index int, filePath string) (ImageSource, error) {
	hash, err := r.stashCommitHash(index)
	if err != nil {
		return ImageSource{}, err
	}
	commit, err := r.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return ImageSource{}, err
	}
	if len(commit.ParentHashes) == 0 {
		return ImageSource{}, nil
	}
	parent, err := r.repo.CommitObject(commit.ParentHashes[0])
	if err != nil {
		return ImageSource{}, err
	}
	tree, err := parent.Tree()
	if err != nil {
		return ImageSource{}, err
	}
	return r.imageFromTree(tree, filePath)
}

// GetImageFromStash returns the image at filePath as saved inside the stash.
// Tracked changes live in the stash commit's tree; untracked files (-u stashes)
// are stored in the stash's third parent commit, which is checked as a fallback.
func (r *Repository) GetImageFromStash(index int, filePath string) (ImageSource, error) {
	hash, err := r.stashCommitHash(index)
	if err != nil {
		return ImageSource{}, err
	}
	commit, err := r.repo.CommitObject(plumbing.NewHash(hash))
	if err != nil {
		return ImageSource{}, err
	}
	tree, err := commit.Tree()
	if err != nil {
		return ImageSource{}, err
	}
	img, err := r.imageFromTree(tree, filePath)
	if err != nil || img.DataURL != "" {
		return img, err
	}
	// Not in the stash commit's tree — check the untracked commit (third parent).
	if len(commit.ParentHashes) >= 3 {
		untracked, err := r.repo.CommitObject(commit.ParentHashes[2])
		if err == nil {
			if t, err := untracked.Tree(); err == nil {
				return r.imageFromTree(t, filePath)
			}
		}
	}
	return ImageSource{}, nil
}
