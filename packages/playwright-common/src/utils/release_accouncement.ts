/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator, type Page } from "playwright-core";

/**
 * Close the release announcement with the given name.
 * @param page The Playwright page instance.
 * @param name The name of the release announcement dialog.
 */
export async function closeReleaseAnnouncement(page: Page, name: string): Promise<void> {
    await page.getByRole("dialog", { name }).getByRole("button", { name: "OK" }).click();
}

/**
 * Close the release announcement with the given name, if it exists.
 * @param page The Playwright page instance.
 * @param name The name of the release announcement dialog.
 * @returns true if the release announcement was found and closed, otherwise false.
 */
export async function closeReleaseAnnouncementIfExists(page: Page, name: string): Promise<boolean> {
    const announcement: Locator = page.getByRole("dialog", { name });
    try {
        await announcement.waitFor({ state: "visible", timeout: 2000 });
    } catch {
        return false;
    }

    await announcement.getByRole("button", { name: "OK" }).click();
    return true;
}
