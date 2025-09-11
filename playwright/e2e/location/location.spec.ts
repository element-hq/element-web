/*
Copyright 2024, 2025 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Locator, type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";

// Firefox headless lacks WebGL support https://bugzilla.mozilla.org/show_bug.cgi?id=1375585
test.describe("Location sharing", { tag: "@no-firefox" }, () => {
    const selectLocationShareTypeOption = (page: Page, shareType: string): Locator => {
        return page.getByTestId(`share-location-option-${shareType}`);
    };

    const submitShareLocation = (page: Page): Promise<void> => {
        return page.getByRole("button", { name: "Share location" }).click();
    };

    test.use({
        displayName: "Tom",
    });

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem("mx_lhs_size", "0");
        });
    });

    test("sends and displays pin drop location message successfully", async ({ page, user, app }) => {
        const roomId = await app.client.createRoom({});
        await page.goto(`/#/room/${roomId}`);

        const composerOptions = await app.openMessageComposerOptions();
        await composerOptions.getByRole("menuitem", { name: "Location", exact: true }).click();

        await selectLocationShareTypeOption(page, "Pin").click();

        await page.locator("#mx_LocationPicker_map").click();

        await submitShareLocation(page);

        await page.locator(".mx_RoomView_body .mx_EventTile .mx_MLocationBody").click({
            position: {
                x: 225,
                y: 150,
            },
        });

        // clicking location tile opens maximised map
        await expect(page.getByRole("dialog")).toBeVisible();

        await app.closeDialog();

        await expect(page.locator(".mx_Marker")).toBeVisible();
    });

    test(
        "is prompted for and can consent to live location sharing",
        { tag: "@screenshot" },
        async ({ page, user, app, axe }) => {
            await app.viewRoomById(await app.client.createRoom({}));

            const composerOptions = await app.openMessageComposerOptions();
            await composerOptions.getByRole("menuitem", { name: "Location", exact: true }).click();
            const menu = page.locator(".mx_LocationShareMenu");

            await menu.getByRole("button", { name: "My live location" }).click();
            await menu.getByLabel("Enable live location sharing").check();

            axe.disableRules([
                "color-contrast", // XXX: Inheriting colour contrast issues from room view.
                "region", // XXX: ContextMenu managed=false does not provide a role.
            ]);
            await expect(axe).toHaveNoViolations();
            await expect(menu).toMatchScreenshot("location-live-share-dialog.png");
        },
    );
});
