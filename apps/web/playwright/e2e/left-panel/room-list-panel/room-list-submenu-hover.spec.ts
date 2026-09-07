/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Locator, type Page } from "@playwright/test";
import { rejectToast } from "@element-hq/element-web-playwright-common";

import { expect, test } from "../../../element-web-test";
import { getRoomList } from "./utils";

/**
 * Hover dismissal of the "Move to" submenu depends on real pointer geometry:
 * Radix decides whether the pointer is heading for the submenu from its
 * coordinates and direction. Synthetic events carry neither, so this behaviour
 * can only be exercised end to end with a real mouse.
 */
test.describe("Room list submenu hover dismissal", () => {
    test.use({ displayName: "Alice" });

    /** How long to wait for a dismissal that should never arrive. */
    const LONGER_THAN_GRACE_PERIOD = 1000;

    test.beforeEach(async ({ page, user }) => {
        await rejectToast(page, "Verify this device");
        await rejectToast(page, "Notifications");
        // Focus the user menu so the room list has no stray hover decoration.
        await page.getByRole("button", { name: "User menu" }).focus();
    });

    /** Opens a room's "More Options" menu and hovers "Move to" to open its submenu. */
    async function openMoveToSubMenu(page: Page): Promise<{ moveTo: Locator; subMenuItem: Locator }> {
        const roomItem = getRoomList(page).getByRole("option", { name: "Open room my room" });
        await expect(roomItem).toBeVisible();

        await roomItem.hover();
        await roomItem.getByRole("button", { name: "More Options" }).click();

        const moveTo = page.getByRole("menuitem", { name: "Move to" });
        await moveTo.hover();

        // With no custom sections yet, "New section" is the submenu's only item.
        const subMenuItem = page.getByRole("menuitem", { name: "New section" });
        await expect(subMenuItem).toBeVisible();

        return { moveTo, subMenuItem };
    }

    test("should dismiss only the submenu when the mouse leaves 'Move to' without entering it", async ({
        page,
        app,
    }) => {
        await app.client.createRoom({ name: "my room" });
        const { moveTo, subMenuItem } = await openMoveToSubMenu(page);

        // Move into the parent menu just below "Move to": inside the menu, but
        // in the gap between items rather than on an item. Radix dismisses the
        // submenu when the pointer reaches a sibling item or leaves the menu,
        // but not here — which is what leaves the submenu stranded on screen.
        const box = await moveTo.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height + 3);

        await expect(subMenuItem).not.toBeVisible();
        // The parent menu is left alone.
        await expect(moveTo).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Leave room" })).toBeVisible();
    });

    test("should keep the submenu open once the mouse has been inside it", async ({ page, app }) => {
        await app.client.createRoom({ name: "my room" });
        const { subMenuItem } = await openMoveToSubMenu(page);

        // The user commits to the submenu...
        await subMenuItem.hover();
        // ...and then moves well clear of both it and its trigger.
        await page.mouse.move(1200, 40);

        // Standard cascade-menu behaviour: the submenu stays until the user
        // explicitly dismisses it.
        await page.waitForTimeout(LONGER_THAN_GRACE_PERIOD);
        await expect(subMenuItem).toBeVisible();
    });
});
