//go:build darwin && cgo && sparkle

// Package update provides auto-update support via the Sparkle framework on macOS.
//
// This file is compiled only when the "sparkle" build tag is set, which also
// requires CGo and a macOS target.  The release CI passes -tags sparkle.
//
// Setup:
//   1. Download Sparkle 2 from https://github.com/sparkle-project/Sparkle/releases
//   2. Place Sparkle.framework in app/vendor/frameworks/
//   3. Build with: CGO_ENABLED=1 wails build -tags sparkle -ldflags "..."
package update

/*
#cgo LDFLAGS: -framework Sparkle -F${SRCDIR}/../vendor/frameworks
#cgo CFLAGS: -I${SRCDIR}/../vendor/frameworks/Sparkle.framework/Headers

#import <Foundation/Foundation.h>
#import <Sparkle/Sparkle.h>

void setupSparkle(const char* appcastURL) {
	@autoreleasepool {
		SUUpdater *updater = SUUpdater.sharedUpdater;
		updater.feedURL = [NSURL URLWithString:@(appcastURL)];
		updater.automaticallyChecksForUpdates = YES;
		updater.automaticallyDownloadsUpdates = NO;
		[updater checkForUpdatesInBackground];
	}
}
*/
import "C"

import "unsafe"

// SetupSparkle configures Sparkle 2 with the given appcast URL and starts
// background update checking. Must be called from the main goroutine after
// the application window is visible.
//
// The SUFeedURL, SUPublicEDKey, and SUScheduledCheckInterval values in
// Info.plist are also respected by Sparkle; this call overrides the feed URL
// at runtime so the same binary can target different update channels.
func SetupSparkle(appcastURL string) {
	cURL := C.CString(appcastURL)
	defer C.free(unsafe.Pointer(cURL))
	C.setupSparkle(cURL)
}
