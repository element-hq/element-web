/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page, expect } from "@playwright/test";

import { type ElementAppPage } from "../../pages/ElementAppPage";

export async function viewRoomSummaryByName(page: Page, app: ElementAppPage, name: string): Promise<void> {
    await app.viewRoomByName(name);
    await app.toggleRoomInfoPanel();
    return checkRoomSummaryCard(page, name);
}

export async function checkRoomSummaryCard(page: Page, name: string): Promise<void> {
    await expect(page.locator(".mx_RoomSummaryCard")).toBeVisible();
    await expect(page.locator(".mx_RoomSummaryCard")).toContainText(name);
}
