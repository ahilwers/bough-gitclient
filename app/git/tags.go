package git

import (
	"sort"
	"strings"

	"github.com/go-git/go-git/v5/plumbing"
)

// ListTags returns all tags sorted newest-first by the tagger date (annotated)
// or committer date (lightweight).
func (r *Repository) ListTags() ([]Tag, error) {
	iter, err := r.repo.Tags()
	if err != nil {
		return nil, err
	}

	var tags []Tag
	_ = iter.ForEach(func(ref *plumbing.Reference) error {
		name := ref.Name().Short()

		// Annotated tag: ref → tag object → target commit.
		if tagObj, err := r.repo.TagObject(ref.Hash()); err == nil {
			tags = append(tags, Tag{
				Name:    name,
				Hash:    tagObj.Target.String(),
				Date:    tagObj.Tagger.When,
				Message: strings.TrimSpace(tagObj.Message),
			})
			return nil
		}

		// Lightweight tag: ref points directly to a commit.
		if commit, err := r.repo.CommitObject(ref.Hash()); err == nil {
			tags = append(tags, Tag{
				Name: name,
				Hash: commit.Hash.String(),
				Date: commit.Committer.When,
			})
		}
		return nil
	})

	sort.Slice(tags, func(i, j int) bool {
		return tags[i].Date.After(tags[j].Date)
	})

	return tags, nil
}

// CheckoutTag detaches HEAD at the commit the tag points to.
func (r *Repository) CheckoutTag(tag string) error {
	_, err := CLI(r.Path, "checkout", tag)
	return err
}

// DeleteTag removes a local tag by name.
func (r *Repository) DeleteTag(tag string) error {
	_, err := CLI(r.Path, "tag", "-d", tag)
	return err
}
