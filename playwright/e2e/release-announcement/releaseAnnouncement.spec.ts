/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
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

    test("should display the release announcement process", async ({ page, app, util }) => {
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
