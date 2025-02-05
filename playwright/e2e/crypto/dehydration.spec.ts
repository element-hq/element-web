/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Locator, type Page } from "@playwright/test";

import { test, expect } from "../../element-web-test";
import { viewRoomSummaryByName } from "../right-panel/utils";
import { isDendrite } from "../../plugins/homeserver/dendrite";
import { completeCreateSecretStorageDialog, createBot, logIntoElement } from "./utils.ts";
import { type Client } from "../../pages/client.ts";

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

    test("'Set up secure backup' creates dehydrated device", async ({ page, user, app }, workerInfo) => {
        // Create a backup (which will create SSSS, and dehydrated device)

        const securityTab = await app.settings.openUserSettings("Security & Privacy");

        await expect(securityTab.getByRole("heading", { name: "Secure Backup" })).toBeVisible();
        await expect(securityTab.getByText("Offline device enabled")).not.toBeVisible();
        await securityTab.getByRole("button", { name: "Set up", exact: true }).click();

        await completeCreateSecretStorageDialog(page);

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

    test("Reset recovery key during login re-creates dehydrated device", async ({
        page,
        homeserver,
        app,
        credentials,
    }) => {
        // Set up cross-signing and recovery
        const { botClient } = await createBot(page, homeserver, credentials);
        // ... and dehydration
        await botClient.evaluate(async (client) => await client.getCrypto().startDehydration());

        const initialDehydratedDeviceIds = await getDehydratedDeviceIds(botClient);
        expect(initialDehydratedDeviceIds.length).toBe(1);

        await botClient.evaluate(async (client) => client.stopClient());

        // Log in our client
        await logIntoElement(page, credentials);

        // Oh no, we forgot our recovery key
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Reset all" }).click();
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Proceed with reset" }).click();

        await completeCreateSecretStorageDialog(page, { accountPassword: credentials.password });

        // There should be a brand new dehydrated device
        const dehydratedDeviceIds = await getDehydratedDeviceIds(app.client);
        expect(dehydratedDeviceIds.length).toBe(1);
        expect(dehydratedDeviceIds[0]).not.toEqual(initialDehydratedDeviceIds[0]);
    });
});

async function getDehydratedDeviceIds(client: Client): Promise<string[]> {
    return await client.evaluate(async (client) => {
        const userId = client.getUserId();
        const devices = await client.getCrypto().getUserDeviceInfo([userId]);
        return Array.from(
            devices
                .get(userId)
                .values()
                .filter((d) => d.dehydrated)
                .map((d) => d.deviceId),
        );
    });
}
