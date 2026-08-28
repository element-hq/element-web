/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";

test.describe("Image packs settings", () => {
    const shortcode = "wave";
    const packName = "Waves pack";

    test.use({
        displayName: "Bob",
        room: async ({ app }, use) => {
            const roomId = await app.client.createRoom({ name: "Image packs room" });
            await use({ roomId });
        },
    });

    test("creates a personal pack, adds an emote, and sees it autocomplete in the composer", async ({
        page,
        app,
        room,
    }) => {
        // Open the new Image packs tab.
        const settings = await app.settings.openUserSettings("Image packs");
        await expect(settings.getByRole("heading", { name: "Image packs" })).toBeVisible();

        // Create the personal pack via the module's UI.
        const newPackForm = page.getByTestId("new-user-pack-form");
        await newPackForm.getByLabel("Personal pack display name").fill(packName);
        await newPackForm.getByRole("button", { name: "Create pack" }).click();

        // The pack card should now appear.
        const packCard = page.getByTestId("pack-personal");
        await expect(packCard).toBeVisible();
        await expect(packCard.getByRole("heading")).toContainText(packName);

        // Add an emote to the pack.
        await packCard.getByLabel("Shortcode").fill(shortcode);
        await packCard.getByLabel("Image URL").fill("mxc://example.org/wave");
        await packCard.getByLabel("Body").fill("A friendly wave");
        await packCard.getByRole("button", { name: "Add emote" }).click();

        const emote = page.getByTestId(`emote-${shortcode}`);
        await expect(emote).toBeVisible();

        // Enable the pack for the room via the room settings → Image packs tab.
        await app.viewRoomById(room.roomId);
        await app.settings.openRoomSettings("Image packs");
        await expect(page.getByRole("heading", { name: "Image packs" })).toBeVisible();

        // The personal pack should be discoverable from the room context; the
        // room-scoped section is the place to install/enable.
        await expect(page.getByText(packName)).toBeVisible();

        // Type the shortcode in the composer; the autocomplete should surface the pack.
        const composer = app.getComposerField();
        await composer.fill(`:${shortcode}`);
        const autocomplete = page.getByRole("listbox");
        await expect(autocomplete).toBeVisible();
        await expect(autocomplete.getByText(packName)).toBeVisible();
    });
});
