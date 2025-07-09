/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { waitForPageReady } from "@storybook/test-runner";
import { toMatchImageSnapshot } from "jest-image-snapshot";

const customSnapshotsDir = `${process.cwd()}/playwright/shared-component-snapshots/`;
const customReceivedDir = `${process.cwd()}/playwright/shared-component-received/`;

/**
 * @type {import('@storybook/test-runner').TestRunnerConfig}
 */
const config = {
    setup(page) {
        expect.extend({ toMatchImageSnapshot });
    },
    async postVisit(page, context) {
        await waitForPageReady(page);

        // If you want to take screenshot of multiple browsers, use
        // page.context().browser().browserType().name() to get the browser name to prefix the file name
        const image = await page.screenshot();
        expect(image).toMatchImageSnapshot({
            customSnapshotsDir,
            customSnapshotIdentifier: `${context.id}-${process.platform}`,
            storeReceivedOnFailure: true,
            customReceivedDir,
            customDiffDir: customReceivedDir,
        });
    },
};

export default config;
