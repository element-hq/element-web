/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { createRoom, enableKeyBackup, logIntoElement, sendMessageInCurrentRoom } from "./utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";

test.describe("Logout tests", () => {
    test.skip(isDendrite, "Dendrite lacks support for MSC3967 so requires additional auth here");
    test.beforeEach(async ({ page, homeserver, credentials }) => {
        await logIntoElement(page, credentials);
    });

    test("Ask to set up recovery on logout if not setup", async ({ page, app }) => {
        await createRoom(page, "E2e room", true);

        // send a message (will be the first one so will create a new megolm session)
        await sendMessageInCurrentRoom(page, "Hello secret world");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(
            currentDialogLocator.getByRole("heading", { name: "You'll lose access to your encrypted messages" }),
        ).toBeVisible();
    });

    test("If backup is set up show standard confirm", async ({ page, app }) => {
        await enableKeyBackup(app);

        await createRoom(page, "E2e room", true);

        // send a message (will be the first one so will create a new megolm session)
        await sendMessageInCurrentRoom(page, "Hello secret world");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        await expect(currentDialogLocator.getByText("Are you sure you want to sign out?")).toBeVisible();
    });

    test("Logout directly if the user has no room keys", async ({ page, app }) => {
        await createRoom(page, "Clear room", false);

        await sendMessageInCurrentRoom(page, "Hello public world!");

        const locator = await app.settings.openUserMenu();
        await locator.getByRole("menuitem", { name: "Sign out", exact: true }).click();

        // Should have logged out directly
        await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
});
