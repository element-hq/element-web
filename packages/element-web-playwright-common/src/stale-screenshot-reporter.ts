/*
Copyright 2024 - 2025 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Test reporter which compares the reported screenshots vs those on disk to find stale screenshots
 * Only intended to run from within GitHub Actions
 */

import { glob } from "glob";
import path from "node:path";
import { type Reporter, type TestCase } from "@playwright/test/reporter";
import { type FullConfig } from "@playwright/test";

/**
 * The annotation type used to mark screenshots in tests.
 * `_` prefix hides it from the HTML reporter
 */
export const ANNOTATION = "_screenshot";

class StaleScreenshotReporter implements Reporter {
    private readonly snapshotRoots = new Set<string>();
    private readonly screenshots = new Set<string>();
    private failing = false;
    private success = true;

    public onBegin(config: FullConfig): void {
        for (const project of config.projects) {
            this.snapshotRoots.add(project.snapshotDir);
        }
    }

    public onTestEnd(test: TestCase): void {
        if (!test.ok()) {
            this.failing = true;
        }
        for (const annotation of test.annotations) {
            if (annotation.type === ANNOTATION && annotation.description) {
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
        if (!this.snapshotRoots.size) {
            this.error("No snapshot directories found, did you set the snapshotDir in your Playwright config?", "");
            return;
        }

        const screenshotFiles = new Set<string>();
        for (const snapshotRoot of this.snapshotRoots) {
            const files = await glob(`**/*.png`, { cwd: snapshotRoot });
            for (const file of files) {
                screenshotFiles.add(path.join(snapshotRoot, file));
            }
        }

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
