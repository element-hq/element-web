/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Test reporter which compares the reported screenshots vs those on disk to find stale screenshots
 * Only intended to run from within GitHub Actions
 */

import path from "node:path";
import { glob } from "glob";

import type { Reporter, TestCase } from "@playwright/test/reporter";

const snapshotRoot = path.join(__dirname, "snapshots");

class StaleScreenshotReporter implements Reporter {
    private screenshots = new Set<string>();
    private failing = false;
    private success = true;

    public onTestEnd(test: TestCase): void {
        if (!test.ok()) {
            this.failing = true;
        }
        for (const annotation of test.annotations) {
            if (annotation.type === "_screenshot") {
                this.screenshots.add(annotation.description);
            }
        }
    }

    private error(msg: string, file: string) {
        if (process.env.GITHUB_ACTIONS) {
            console.log(`::error file=${file}::${msg}`);
        }
        console.error(msg, file);
        this.success = false;
    }

    public async onExit(): Promise<void> {
        if (this.failing) return;
        const screenshotFiles = new Set(await glob(`**/*.png`, { cwd: snapshotRoot }));
        for (const screenshot of screenshotFiles) {
            if (screenshot.split("-").at(-1) !== "linux.png") {
                this.error(
                    "Found screenshot belonging to different platform, this should not be checked in",
                    screenshot,
                );
            }
        }
        for (const screenshot of this.screenshots) {
            screenshotFiles.delete(screenshot);
        }
        if (screenshotFiles.size > 0) {
            for (const screenshot of screenshotFiles) {
                this.error("Stale screenshot file", screenshot);
            }
        }

        if (!this.success) {
            process.exit(1);
        }
    }
}

export default StaleScreenshotReporter;
