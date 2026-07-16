/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";

/**
 * Covers `compactMessageActions`: hovering a message reveals a single options button rather than a row of
 * buttons over a highlighted row, and the actions it collapses stay reachable through the menu.
 *
 * The suite-wide default is off (see packages/playwright-common CONFIG_JSON), so each test turns it on.
 */
test.describe("Compact message actions", () => {
    test.use({
        displayName: "Alice",
        room: async ({ user, app }, use) => {
            const roomId = await app.client.createRoom({ name: "Test room" });
            await use({ roomId });
        },
    });

    const sendMessage = async (page: Page, body: string) => {
        await page.getByRole("textbox", { name: "Send an unencrypted message…" }).fill(body);
        await page.getByRole("button", { name: "Send message" }).click();
        const tile = page.locator(".mx_EventTile_last");
        await expect(tile.getByRole("status")).toHaveAccessibleName("Your message was sent");
        return tile;
    };

    test("collapses the action bar into a single options button on hover", async ({ page, app, room }) => {
        await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, true);
        await page.goto(`#/room/${room.roomId}`);

        const tile = await sendMessage(page, "Hello");
        await tile.hover();

        const toolbar = tile.getByRole("toolbar", { name: "Message Actions" });
        await expect(toolbar).toBeVisible();
        // The point of the setting: one button, not six.
        await expect(toolbar.getByRole("button")).toHaveCount(1);
        await expect(toolbar.getByRole("button", { name: "Options" })).toBeVisible();
    });

    test("keeps the collapsed actions reachable from the options menu", async ({ page, app, room }) => {
        await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, true);
        await page.goto(`#/room/${room.roomId}`);

        const tile = await sendMessage(page, "Hello");
        await tile.hover();
        await tile.getByRole("button", { name: "Options" }).click();

        // Collapsing the bar must not remove the actions, only move them. `exact` matters: without it "Reply"
        // also matches "Reply in thread".
        await expect(page.getByRole("menuitem", { name: "Reply", exact: true })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Reply in thread", exact: true })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "React", exact: true })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).toBeVisible();
    });

    test("opens the reaction picker from the options menu", async ({ page, app, room }) => {
        await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, true);
        await page.goto(`#/room/${room.roomId}`);

        const tile = await sendMessage(page, "Hello");
        await tile.hover();
        await tile.getByRole("button", { name: "Options" }).click();
        await page.getByRole("menuitem", { name: "React", exact: true }).click();

        // The picker is the full emoji picker, opened as a nested menu beside the options menu.
        await expect(page.getByRole("textbox", { name: "Search" })).toBeVisible();
    });

    test("removes an existing reaction from the menu rather than duplicating it", async ({ page, app, room }) => {
        await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, true);
        await page.goto(`#/room/${room.roomId}`);

        const tile = await sendMessage(page, "Hello");
        const reactViaMenu = async () => {
            await tile.hover();
            await tile.getByRole("button", { name: "Options" }).click();
            await page.getByRole("menuitem", { name: "React", exact: true }).click();
            await page.locator(".mx_EmojiPicker_body").getByText("😀").first().click();
        };

        // React once from the collapsed menu.
        await reactViaMenu();
        const reaction = tile.locator(".mx_ReactionsRow button").filter({ hasText: "😀" });
        await expect(reaction).toBeVisible();

        // React again with the same emoji. The options menu forwards `reactions` to the picker, so it sees the
        // existing reaction and redacts it; without that prop it would send a duplicate and the pill would stay.
        await reactViaMenu();
        await expect(reaction).toHaveCount(0);
    });

    // The options button is revealed by hover, so it would be trivial to make it mouse-only. axe cannot catch
    // that: it inspects a static page and never simulates hover. This asserts the keyboard path explicitly.
    test("reveals the options button to keyboard users without a mouse", async ({ page, app, room }) => {
        await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, true);
        await page.goto(`#/room/${room.roomId}`);

        // Send with the keyboard, and never click: the tile only reveals its bar for :focus-visible, which the
        // browser grants on focus only while the last interaction was a key press.
        const composer = page.getByRole("textbox", { name: "Send an unencrypted message…" });
        await composer.press("H");
        await composer.pressSequentially("ello");
        await composer.press("Enter");

        const tile = page.locator(".mx_EventTile_last");
        await expect(tile.getByRole("status")).toHaveAccessibleName("Your message was sent");

        const toolbar = tile.getByRole("toolbar", { name: "Message Actions" });
        await expect(toolbar).not.toBeVisible();

        await tile.focus();
        await expect(toolbar).toBeVisible();
        await expect(toolbar.getByRole("button", { name: "Options" })).toBeVisible();
    });

    // The band is painted either on the tile's ::before (bubble) or on the line (group/irc). Read whichever
    // this layout uses.
    const readHoverBackground = async (page: Page, layout: Layout) => {
        const tile = await sendMessage(page, "Hello");
        await tile.hover();
        const target = layout === Layout.Bubble ? tile : tile.locator(".mx_EventTile_line").first();
        return target.evaluate((element, isBubble) => {
            const node = isBubble ? window.getComputedStyle(element, "::before") : window.getComputedStyle(element);
            return node.backgroundColor;
        }, layout === Layout.Bubble);
    };

    const TRANSPARENT = /rgba\(0, 0, 0, 0\)|transparent/;

    for (const layout of [Layout.Group, Layout.Bubble, Layout.IRC]) {
        test(`paints no hover highlight behind the message in ${layout} layout`, async ({ page, app, room }) => {
            await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, true);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, layout);
            await page.goto(`#/room/${room.roomId}`);

            expect(await readHoverBackground(page, layout)).toMatch(TRANSPARENT);
        });

        // Positive control: with the setting off the band must come back. Without this, the assertion above
        // would pass just as happily against a selector that never matches anything.
        test(`still paints the hover highlight in ${layout} layout when the setting is off`, async ({
            page,
            app,
            room,
        }) => {
            await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, false);
            await app.settings.setValue("layout", null, SettingLevel.DEVICE, layout);
            await page.goto(`#/room/${room.roomId}`);

            expect(await readHoverBackground(page, layout)).not.toMatch(TRANSPARENT);
        });
    }

    // Turning the setting off must restore the original menu, not leave the quick actions listed in both
    // places. The bar and the menu each offering Reply/Edit/Pin is the failure mode here.
    test("does not duplicate the quick actions into the menu when the setting is off", async ({ page, app, room }) => {
        await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, false);
        await page.goto(`#/room/${room.roomId}`);

        const tile = await sendMessage(page, "Hello");
        await tile.hover();
        // The bar still offers them...
        await expect(tile.getByRole("button", { name: "Reply", exact: true })).toBeVisible();
        await tile.getByRole("button", { name: "Options" }).click();

        // ...so the menu must not.
        await expect(page.getByRole("menuitem", { name: "Reply", exact: true })).not.toBeVisible();
        await expect(page.getByRole("menuitem", { name: "React", exact: true })).not.toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).not.toBeVisible();
    });

    // Selection must survive the band removal: it shares the rule that :hover was split out of.
    test("still highlights the selected event while its menu is open", async ({ page, app, room }) => {
        await app.settings.setValue("compactMessageActions", null, SettingLevel.DEVICE, true);
        await app.settings.setValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
        await page.goto(`#/room/${room.roomId}`);

        const tile = await sendMessage(page, "Hello");
        await tile.hover();
        await tile.getByRole("button", { name: "Options" }).click();

        const background = await tile.evaluate(
            (element) => window.getComputedStyle(element, "::before").backgroundColor,
        );
        expect(background).not.toMatch(TRANSPARENT);
    });
});
