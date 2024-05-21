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

import { Page } from "@playwright/test";

import { test as base, expect } from "../../element-web-test";

/**
 * Set up for release announcement tests.
 */
export const test = base.extend<{
    util: Helpers;
}>({
    displayName: "Alice",
    botCreateOpts: { displayName: "Other User" },

    util: async ({ page, app, bot }, use) => {
        await use(new Helpers(page));
    },
});

export class Helpers {
    constructor(private page: Page) {}

    /**
     * Get the release announcement with the given name.
     * @param name
     * @private
     */
    private getReleaseAnnouncement(name: string) {
        return this.page.getByRole("dialog", { name });
    }

    /**
     * Assert that the release announcement with the given name is visible.
     * @param name
     */
    async assertReleaseAnnouncementIsVisible(name: string) {
        await expect(this.getReleaseAnnouncement(name)).toBeVisible();
        await expect(this.page).toMatchScreenshot(`release-announcement-${name}.png`);
    }

    /**
     * Assert that the release announcement with the given name is not visible.
     * @param name
     */
    assertReleaseAnnouncementIsNotVisible(name: string) {
        return expect(this.getReleaseAnnouncement(name)).not.toBeVisible();
    }

    /**
     * Mark the release announcement with the given name as read.
     * If the release announcement is not visible, this will throw an error.
     * @param name
     */
    async markReleaseAnnouncementAsRead(name: string) {
        const dialog = this.getReleaseAnnouncement(name);
        await dialog.getByRole("button", { name: "Ok" }).click();
    }
}

export { expect };
