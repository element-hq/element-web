/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Page } from "playwright-core";

/**
 * Close the release announcement with the given name.
 * @param page The Playwright page instance.
 * @param name The name of the release announcement dialog.
 */
export async function closeReleaseAnnouncement(page: Page, name: string): Promise<void> {
    await page.getByRole("dialog", { name }).getByRole("button", { name: "OK" }).click();
}
