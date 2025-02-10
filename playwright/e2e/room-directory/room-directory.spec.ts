/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Preset, Visibility } from "matrix-js-sdk/src/matrix";
import { test, expect } from "../../element-web-test";

test.describe("Room Directory", () => {
    test.skip(({ homeserverType }) => homeserverType === "pinecone", "Pinecone's /publicRooms API takes forever");
    test.use({
        displayName: "Ray",
        botCreateOpts: { displayName: "Paul" },
    });

    test(
        "should allow admin to add alias & publish room to directory",
        { tag: "@no-webkit" },
        async ({ page, app, user, bot }) => {
            const roomId = await app.client.createRoom({
                name: "Gaming",
                preset: "public_chat" as Preset,
            });

            await app.viewRoomByName("Gaming");
            await app.settings.openRoomSettings();

            // First add a local address `gaming`
            const localAddresses = page.locator(".mx_SettingsFieldset", { hasText: "Local Addresses" });
            await localAddresses.getByRole("textbox").fill("gaming");
            await expect(page.getByText("This address is available to use")).toBeVisible();
            await localAddresses.getByRole("button", { name: "Add" }).click();
            await expect(localAddresses.getByText(`#gaming:${user.homeServer}`)).toHaveClass("mx_EditableItem_item");

            // Publish into the public rooms directory
            const publishedAddresses = page.locator(".mx_SettingsFieldset", { hasText: "Published Addresses" });
            await expect(publishedAddresses.locator("#canonicalAlias")).toHaveValue(`#gaming:${user.homeServer}`);
            const checkbox = publishedAddresses
                .locator(".mx_SettingsFlag", {
                    hasText: `Publish this room to the public in ${user.homeServer}'s room directory?`,
                })
                .getByRole("switch");
            await checkbox.check();
            await expect(checkbox).toBeChecked();

            await app.closeDialog();

            const resp = await bot.publicRooms({});
            expect(resp.total_room_count_estimate).toEqual(1);
            expect(resp.chunk).toHaveLength(1);
            expect(resp.chunk[0].room_id).toEqual(roomId);
        },
    );

    test(
        "should allow finding published rooms in directory",
        { tag: "@screenshot" },
        async ({ page, app, user, bot }) => {
            const name = "This is a public room";
            await bot.createRoom({
                visibility: "public" as Visibility,
                name,
                room_alias_name: "test1234",
            });

            await page.getByRole("button", { name: "Explore rooms" }).click();

            const dialog = page.locator(".mx_SpotlightDialog");
            await dialog.getByRole("textbox", { name: "Search" }).fill("Unknown Room");
            await expect(
                dialog.getByText(
                    "If you can't find the room you're looking for, ask for an invite or create a new room.",
                ),
            ).toHaveClass("mx_SpotlightDialog_otherSearches_messageSearchText");

            await expect(page.locator(".mx_Dialog")).toMatchScreenshot("filtered-no-results.png");

            await dialog.getByRole("textbox", { name: "Search" }).fill("test1234");
            await expect(dialog.getByText(name)).toHaveClass("mx_SpotlightDialog_result_publicRoomName");

            await expect(page.locator(".mx_Dialog")).toMatchScreenshot("filtered-one-result.png");

            await page
                .locator(".mx_SpotlightDialog .mx_SpotlightDialog_option")
                .getByRole("button", { name: "Join" })
                .click();

            await expect(page).toHaveURL(`/#/room/#test1234:${user.homeServer}`);
        },
    );
});
