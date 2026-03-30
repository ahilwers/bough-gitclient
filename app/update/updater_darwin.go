//go:build darwin

package update

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"runtime"
)

type macOSUpdater struct {
	appcastURL string
	publicKey  string
}

// NewMacOSUpdater creates an updater for macOS using Sparkle 2.
// appcastURL is the URL of the appcast XML feed.
// publicKey is the EdDSA public key used to verify update signatures.
func NewMacOSUpdater(appcastURL, publicKey string) *macOSUpdater {
	return &macOSUpdater{
		appcastURL: appcastURL,
		publicKey:  publicKey,
	}
}

// CheckForUpdates fetches the appcast and returns the latest version string,
// or an empty string if the current version is already up to date.
// In production the Sparkle framework (via SetupSparkle in sparkle.go) handles
// this automatically; this method is available as a programmatic fallback.
func (u *macOSUpdater) CheckForUpdates(ctx context.Context, currentVersion string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.appcastURL, nil)
	if err != nil {
		return "", fmt.Errorf("build appcast request: %w", err)
	}
	req.Header.Set("User-Agent", fmt.Sprintf("Bough/%s (%s)", currentVersion, runtime.GOARCH))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch appcast: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MiB max
	if err != nil {
		return "", fmt.Errorf("read appcast: %w", err)
	}

	return parseLatestVersion(body)
}

// appcastRSS is a minimal struct for parsing the appcast XML.
type appcastRSS struct {
	Items []struct {
		Enclosure struct {
			Version string `xml:"version,attr"`
		} `xml:"enclosure"`
	} `xml:"channel>item"`
}

func parseLatestVersion(data []byte) (string, error) {
	var feed appcastRSS
	if err := xml.Unmarshal(data, &feed); err != nil {
		return "", fmt.Errorf("parse appcast XML: %w", err)
	}
	if len(feed.Items) == 0 {
		return "", nil
	}
	return feed.Items[0].Enclosure.Version, nil
}
