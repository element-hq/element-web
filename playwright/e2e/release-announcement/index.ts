/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Page } from "@playwright/test";

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
        await expect(this.page).toMatchScreenshot(`release-announcement-${name}.png`, { showTooltips: true });
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
