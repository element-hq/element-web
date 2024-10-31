/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Locator, type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { checkRoomSummaryCard, viewRoomSummaryByName } from "./utils";

const ROOM_NAME = "Test room";
const ROOM_NAME_LONG =
    "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore " +
    "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
    "aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum " +
    "dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui " +
    "officia deserunt mollit anim id est laborum.";
const SPACE_NAME = "Test space";
const NAME = "Alice";
const ROOM_ADDRESS_LONG =
    "loremIpsumDolorSitAmetConsecteturAdipisicingElitSedDoEiusmodTemporIncididuntUtLaboreEtDoloreMagnaAliqua";

function getMemberTileByName(page: Page, name: string): Locator {
    return page.locator(`.mx_EntityTile, [title="${name}"]`);
}

test.describe("RightPanel", () => {
    test.use({
        displayName: NAME,
    });

    test.beforeEach(async ({ app, user }) => {
        await app.client.createRoom({ name: ROOM_NAME });
        await app.client.createSpace({ name: SPACE_NAME });
    });

    test.describe("in rooms", () => {
        test("should handle long room address and long room name", async ({ page, app }) => {
            await app.client.createRoom({ name: ROOM_NAME_LONG });
            await viewRoomSummaryByName(page, app, ROOM_NAME_LONG);

            await app.settings.openRoomSettings();

            // Set a local room address
            const localAddresses = page.locator(".mx_SettingsFieldset", { hasText: "Local Addresses" });
            await localAddresses.getByRole("textbox").fill(ROOM_ADDRESS_LONG);
            await localAddresses.getByRole("button", { name: "Add" }).click();
            await expect(localAddresses.getByText(`#${ROOM_ADDRESS_LONG}:localhost`)).toHaveClass(
                "mx_EditableItem_item",
            );

            await app.closeDialog();

            // Close and reopen the right panel to render the room address
            await app.toggleRoomInfoPanel();
            await expect(page.locator(".mx_RightPanel")).not.toBeVisible();
            await app.toggleRoomInfoPanel();

            await expect(page.locator(".mx_RightPanel")).toMatchScreenshot("with-name-and-address.png");
        });

        test("should handle clicking add widgets", async ({ page, app }) => {
            await viewRoomSummaryByName(page, app, ROOM_NAME);

            await page.getByRole("menuitem", { name: "Extensions" }).click();
            await page.getByRole("button", { name: "Add extensions" }).click();
            await expect(page.locator(".mx_IntegrationManager")).toBeVisible();
        });

        test("should handle viewing export chat", async ({ page, app }) => {
            await viewRoomSummaryByName(page, app, ROOM_NAME);

            await page.getByRole("menuitem", { name: "Export Chat" }).click();
            await expect(page.locator(".mx_ExportDialog")).toBeVisible();
        });

        test("should handle viewing share room", async ({ page, app }) => {
            await viewRoomSummaryByName(page, app, ROOM_NAME);

            await page.getByRole("menuitem", { name: "Copy link" }).click();
            await expect(page.locator(".mx_ShareDialog")).toBeVisible();
        });

        test("should handle viewing room settings", async ({ page, app }) => {
            await viewRoomSummaryByName(page, app, ROOM_NAME);

            await page.getByRole("menuitem", { name: "Settings" }).click();
            await expect(page.locator(".mx_RoomSettingsDialog")).toBeVisible();
            await expect(page.locator(".mx_Dialog_title").getByText("Room Settings - " + ROOM_NAME)).toBeVisible();
        });

        test("should handle viewing files", async ({ page, app }) => {
            await viewRoomSummaryByName(page, app, ROOM_NAME);

            await page.getByRole("menuitem", { name: "Files" }).click();
            await expect(page.locator(".mx_FilePanel")).toBeVisible();
            await expect(page.locator(".mx_EmptyState")).toBeVisible();

            await page.getByTestId("base-card-back-button").click();
            await checkRoomSummaryCard(page, ROOM_NAME);
        });

        test("should handle viewing room member", async ({ page, app }) => {
            await viewRoomSummaryByName(page, app, ROOM_NAME);

            await page.locator(".mx_RightPanel").getByRole("menuitem", { name: "People" }).click();
            await expect(page.locator(".mx_MemberList")).toBeVisible();

            await getMemberTileByName(page, NAME).click();
            await expect(page.locator(".mx_UserInfo")).toBeVisible();
            await expect(page.locator(".mx_UserInfo_profile").getByText(NAME)).toBeVisible();

            await page.getByTestId("base-card-back-button").click();
            await expect(page.locator(".mx_MemberList")).toBeVisible();

            await page.getByLabel("Room info").nth(1).click();
            await checkRoomSummaryCard(page, ROOM_NAME);
        });
    });

    test.describe("in spaces", () => {
        test("should handle viewing space member", async ({ page, app }) => {
            await app.viewSpaceHomeByName(SPACE_NAME);

            // \d represents the number of the space members
            await page
                .locator(".mx_RoomInfoLine_private")
                .getByRole("button", { name: /\d member/ })
                .click();
            await expect(page.locator(".mx_MemberList")).toBeVisible();

            await getMemberTileByName(page, NAME).click();
            await expect(page.locator(".mx_UserInfo")).toBeVisible();
            await expect(page.locator(".mx_UserInfo_profile").getByText(NAME)).toBeVisible();

            await page.getByTestId("base-card-back-button").click();
            await expect(page.locator(".mx_MemberList")).toBeVisible();
        });
    });
});
