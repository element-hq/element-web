/*
Copyright 2024-2025 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    test,
    expect as baseExpect,
    ElementHandle,
    type ExpectMatcherState,
    type Locator,
    type Page,
    type PageAssertionsToHaveScreenshotOptions,
    type MatcherReturnType,
} from "@playwright/test";
import { sanitizeForFilePath } from "playwright-core/lib/utils";
import { extname } from "node:path";

import { ANNOTATION } from "../stale-screenshot-reporter.js";

// Based on https://github.com/microsoft/playwright/blob/2b77ed4d7aafa85a600caa0b0d101b72c8437eeb/packages/playwright/src/util.ts#L206C8-L210C2
function sanitizeFilePathBeforeExtension(filePath: string): string {
    const ext = extname(filePath);
    const base = filePath.substring(0, filePath.length - ext.length);
    return sanitizeForFilePath(base) + ext;
}

export interface ToMatchScreenshotOptions extends PageAssertionsToHaveScreenshotOptions {
    css?: string;
}

export type Expectations = {
    toMatchScreenshot: (
        this: ExpectMatcherState,
        receiver: Page | Locator,
        name: `${string}.png`,
        options?: ToMatchScreenshotOptions,
    ) => Promise<MatcherReturnType>;
};

/**
 * Provides an upgrade to the `toHaveScreenshot` expectation.
 * Unfortunately, we can't just extend the existing `toHaveScreenshot` expectation
 */
export const expect = baseExpect.extend<Expectations>({
    async toMatchScreenshot(receiver, name, options) {
        const testInfo = test.info();
        if (!testInfo) throw new Error(`toMatchScreenshot() must be called during the test`);

        if (!testInfo.tags.includes("@screenshot")) {
            throw new Error("toMatchScreenshot() must be used in a test tagged with @screenshot");
        }

        const page = "page" in receiver ? receiver.page() : receiver;

        let style: ElementHandle<Element> | undefined;
        if (options?.css) {
            // We add a custom style tag before taking screenshots
            style = (await page.addStyleTag({
                content: options.css,
            })) as ElementHandle<Element>;
        }

        const screenshotName = sanitizeFilePathBeforeExtension(name);
        await baseExpect(receiver).toHaveScreenshot(screenshotName, options);

        await style?.evaluate((tag) => tag.remove());

        testInfo.annotations.push({
            type: ANNOTATION,
            description: testInfo.snapshotPath(screenshotName),
        });

        return { pass: true, message: (): string => "", name: "toMatchScreenshot" };
    },
});
