/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Locator, type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { viewRoomSummaryByName } from "../right-panel/utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";

const ROOM_NAME = "Test room";
const NAME = "Alice";

function getMemberTileByName(page: Page, name: string): Locator {
    return page.locator(`.mx_MemberTileView, [title="${name}"]`);
}

test.use({
    displayName: NAME,
    synapseConfig: {
        experimental_features: {
            msc2697_enabled: false,
            msc3814_enabled: true,
        },
    },
    config: async ({ config, context }, use) => {
        const wellKnown = {
            ...config.default_server_config,
            "org.matrix.msc3814": true,
        };

        await context.route("https://localhost/.well-known/matrix/client", async (route) => {
            await route.fulfill({ json: wellKnown });
        });

        await use(config);
    },
});

test.describe("Dehydration", () => {
    test.skip(isDendrite, "does not yet support dehydration v2");

    test("Create dehydrated device", async ({ page, user, app }, workerInfo) => {
        // Create a backup (which will create SSSS, and dehydrated device)

        const securityTab = await app.settings.openUserSettings("Security & Privacy");

        await expect(securityTab.getByRole("heading", { name: "Secure Backup" })).toBeVisible();
        await expect(securityTab.getByText("Offline device enabled")).not.toBeVisible();
        await securityTab.getByRole("button", { name: "Set up", exact: true }).click();

        const currentDialogLocator = page.locator(".mx_Dialog");

        // It's the first time and secure storage is not set up, so it will create one
        await expect(currentDialogLocator.getByRole("heading", { name: "Set up Secure Backup" })).toBeVisible();
        await currentDialogLocator.getByRole("button", { name: "Continue", exact: true }).click();
        await expect(currentDialogLocator.getByRole("heading", { name: "Save your Security Key" })).toBeVisible();
        await currentDialogLocator.getByRole("button", { name: "Copy", exact: true }).click();
        await currentDialogLocator.getByRole("button", { name: "Continue", exact: true }).click();

        await expect(currentDialogLocator.getByRole("heading", { name: "Secure Backup successful" })).toBeVisible();
        await currentDialogLocator.getByRole("button", { name: "Done", exact: true }).click();

        // Open the settings again
        await app.settings.openUserSettings("Security & Privacy");

        // The Security tab should indicate that there is a dehydrated device present
        await expect(securityTab.getByText("Offline device enabled")).toBeVisible();

        await app.settings.closeDialog();

        // the dehydrated device gets created with the name "Dehydrated
        // device".  We want to make sure that it is not visible as a normal
        // device.
        const sessionsTab = await app.settings.openUserSettings("Sessions");
        await expect(sessionsTab.getByText("Dehydrated device")).not.toBeVisible();

        await app.settings.closeDialog();

        // now check that the user info right-panel shows the dehydrated device
        // as a feature rather than as a normal device
        await app.client.createRoom({ name: ROOM_NAME });

        await viewRoomSummaryByName(page, app, ROOM_NAME);

        await page.locator(".mx_RightPanel").getByRole("menuitem", { name: "People" }).click();
        await expect(page.locator(".mx_MemberListView")).toBeVisible();

        await getMemberTileByName(page, NAME).click();
        await page.locator(".mx_UserInfo_devices .mx_UserInfo_expand").click();

        await expect(page.locator(".mx_UserInfo_devices").getByText("Offline device enabled")).toBeVisible();
        await expect(page.locator(".mx_UserInfo_devices").getByText("Dehydrated device")).not.toBeVisible();
    });
});
