/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { test, expect } from "./";

test.describe("Release announcement", () => {
    test.use({
        config: {
            features: {
                feature_release_announcement: true,
            },
        },
        labsFlags: ["threadsActivityCentre"],
    });

    test("should display the release announcement process", { tag: "@screenshot" }, async ({ page, app, util }) => {
        // The TAC release announcement should be displayed
        await util.assertReleaseAnnouncementIsVisible("Threads Activity Centre");
        // Hide the release announcement
        await util.markReleaseAnnouncementAsRead("Threads Activity Centre");
        await util.assertReleaseAnnouncementIsNotVisible("Threads Activity Centre");

        await page.reload();
        // Wait for EW to load
        await expect(page.getByRole("navigation", { name: "Spaces" })).toBeVisible();
        // Check that once the release announcement has been marked as viewed, it does not appear again
        await util.assertReleaseAnnouncementIsNotVisible("Threads Activity Centre");
    });
});
