/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Locator, type Page } from "@playwright/test";

import { test as base, expect } from "../../element-web-test";
import { viewRoomSummaryByName } from "../right-panel/utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";

const test = base.extend({
    // eslint-disable-next-line no-empty-pattern
    startHomeserverOpts: async ({}, use) => {
        await use("dehydration");
    },
    config: async ({ homeserver, context }, use) => {
        const wellKnown = {
            "m.homeserver": {
                base_url: homeserver.config.baseUrl,
            },
            "org.matrix.msc3814": true,
        };

        await context.route("https://localhost/.well-known/matrix/client", async (route) => {
            await route.fulfill({ json: wellKnown });
        });

        await use({
            default_server_config: wellKnown,
        });
    },
});

const ROOM_NAME = "Test room";
const NAME = "Alice";

function getMemberTileByName(page: Page, name: string): Locator {
    return page.locator(`.mx_EntityTile, [title="${name}"]`);
}

test.describe("Dehydration", () => {
    test.skip(isDendrite, "does not yet support dehydration v2");

    test.use({
        displayName: NAME,
    });

    test("Create dehydrated device", async ({ page, user, app }, workerInfo) => {
        test.skip(workerInfo.project.name === "Legacy Crypto", "This test only works with Rust crypto.");

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

        await page.getByRole("menuitem", { name: "People" }).click();
        await expect(page.locator(".mx_MemberList")).toBeVisible();

        await getMemberTileByName(page, NAME).click();
        await page.locator(".mx_UserInfo_devices .mx_UserInfo_expand").click();

        await expect(page.locator(".mx_UserInfo_devices").getByText("Offline device enabled")).toBeVisible();
        await expect(page.locator(".mx_UserInfo_devices").getByText("Dehydrated device")).not.toBeVisible();
    });
});
