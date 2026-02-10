/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { createNewInstance } from "@element-hq/element-web-playwright-common";

import { test, expect } from "./index";
import { ElementAppPage } from "../../../pages/ElementAppPage";
import { createRoom, sendMessageInCurrentRoom, verifyApp } from "../../crypto/utils";

test.describe("Other people's devices section in Encryption tab", () => {
    test.use({
        displayName: "alice",
    });

    test("unverified devices should be able to decrypt while global blacklist is not toggled", async ({
        page: alicePage,
        app: aliceElementApp,
        homeserver,
        browser,
        user: aliceCredentials,
    }, testInfo) => {
        await aliceElementApp.client.bootstrapCrossSigning(aliceCredentials);

        // Create a second browser instance.
        const bobCredentials = await homeserver.registerUser(`user_${testInfo.testId}_bob`, "password", "bob");
        const bobPage = await createNewInstance(browser, bobCredentials, {});
        const bobElementApp = new ElementAppPage(bobPage);
        await bobElementApp.client.bootstrapCrossSigning(bobCredentials);

        // Create the room and invite bob
        await createRoom(alicePage, "TestRoom", true);
        await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);

        // Bob accepts the invite
        await bobPage.getByRole("option", { name: "TestRoom" }).click();
        await bobPage.getByRole("button", { name: "Accept" }).click();

        // Alice sends a message, which Bob should be able to decrypt
        await sendMessageInCurrentRoom(alicePage, "Decryptable");
        await expect(bobPage.getByText("Decryptable")).toBeVisible();
    });

    test("unverified devices should not be able to decrypt while global blacklist is toggled", async ({
        page: alicePage,
        app: aliceElementApp,
        homeserver,
        browser,
        user: aliceCredentials,
        util,
    }, testInfo) => {
        await aliceElementApp.client.bootstrapCrossSigning(aliceCredentials);

        // Enable blacklist toggle.
        const dialog = await util.openEncryptionTab();
        const blacklistToggle = dialog.getByRole("switch", {
            name: "In encrypted rooms, only send messages to verified users",
        });
        await blacklistToggle.scrollIntoViewIfNeeded();
        await expect(blacklistToggle).toBeVisible();
        await blacklistToggle.click();
        await aliceElementApp.settings.closeDialog();

        // Create a second browser instance.
        const bobCredentials = await homeserver.registerUser(`user_${testInfo.testId}_bob`, "password", "bob");
        const bobPage = await createNewInstance(browser, bobCredentials, {});
        const bobElementApp = new ElementAppPage(bobPage);
        await bobElementApp.client.bootstrapCrossSigning(bobCredentials);

        // Create the room and invite bob
        await createRoom(alicePage, "TestRoom", true);
        await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);

        // Bob accepts the invite
        await bobPage.getByRole("option", { name: "TestRoom" }).click();
        await bobPage.getByRole("button", { name: "Accept" }).click();

        // Alice sends a message, which Bob should not be able to decrypt
        await sendMessageInCurrentRoom(alicePage, "Undecryptable");
        await expect(
            bobPage.getByText(
                "The sender has blocked you from receiving this message because your device is unverified",
            ),
        ).toBeVisible();
    });

    test("verified devices should be able to decrypt while global blacklist is toggled", async ({
        page: alicePage,
        app: aliceElementApp,
        homeserver,
        browser,
        user: aliceCredentials,
        util,
    }, testInfo) => {
        await aliceElementApp.client.bootstrapCrossSigning(aliceCredentials);

        // Enable blacklist toggle.
        const dialog = await util.openEncryptionTab();
        const blacklistToggle = dialog.getByRole("switch", {
            name: "In encrypted rooms, only send messages to verified users",
        });
        await blacklistToggle.scrollIntoViewIfNeeded();
        await expect(blacklistToggle).toBeVisible();
        await blacklistToggle.click();
        await aliceElementApp.settings.closeDialog();

        // Create a second browser instance.
        const bobCredentials = await homeserver.registerUser(`user_${testInfo.testId}_bob`, "password", "bob");
        const bobPage = await createNewInstance(browser, bobCredentials, {});
        const bobElementApp = new ElementAppPage(bobPage);
        await bobElementApp.client.bootstrapCrossSigning(bobCredentials);

        // Create the room and invite bob
        await createRoom(alicePage, "TestRoom", true);
        await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);

        // Bob accepts the invite and dismisses the warnings.
        await bobPage.getByRole("option", { name: "TestRoom" }).click();
        await bobPage.getByRole("button", { name: "Accept" }).click();
        await bobPage.getByRole("button", { name: "Dismiss" }).click(); // enable notifications
        await bobPage.getByRole("button", { name: "Dismiss" }).click(); // enable key storage
        await bobPage.getByRole("button", { name: "Yes, dismiss" }).click(); // enable key storage x2

        // Perform verification.
        await verifyApp("alice", aliceElementApp, "bob", bobElementApp);

        // Alice sends a message, which Bob should be able to decrypt
        await sendMessageInCurrentRoom(alicePage, "Decryptable");
        await expect(bobPage.getByText("Decryptable")).toBeVisible();
    });

    test("setting per-room unverified blacklist toggle does not affect other rooms", async ({
        page: alicePage,
        app: aliceElementApp,
        homeserver,
        browser,
        user: aliceCredentials,
    }, testInfo) => {
        await aliceElementApp.client.bootstrapCrossSigning(aliceCredentials);

        // Create a second browser instance.
        const bobCredentials = await homeserver.registerUser(`user_${testInfo.testId}_bob`, "password", "bob");
        const bobPage = await createNewInstance(browser, bobCredentials, {});
        const bobElementApp = new ElementAppPage(bobPage);
        await bobElementApp.client.bootstrapCrossSigning(bobCredentials);

        // Alice creates the room and invite Bob.
        await createRoom(alicePage, "TestRoom", true);
        await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);

        // Bob accepts the invite.
        await bobPage.getByRole("option", { name: "TestRoom" }).click();
        await bobPage.getByRole("button", { name: "Accept" }).click();

        // Alice configures her client to blacklist unverified users in this room.
        const dialog = await aliceElementApp.settings.openRoomSettings("Security & Privacy");
        await dialog.getByRole("switch", { name: "Only send messages to verified users." }).click();
        await aliceElementApp.settings.closeDialog();

        // Alice sends a message which Bob should not be able to decrypt.
        await sendMessageInCurrentRoom(alicePage, "Undecryptable");
        await expect(
            bobPage.getByText(
                "The sender has blocked you from receiving this message because your device is unverified",
            ),
        ).toBeVisible();

        // Alice dismisses key storage warnings, as they now hide the "New conversation" button.
        await alicePage.getByRole("button", { name: "Dismiss" }).click(); // enable key storage
        await alicePage.getByRole("button", { name: "Yes, dismiss" }).click(); // enable key storage x2

        // Alice creates a second room and invites Bob.
        await createRoom(alicePage, "TestRoom2", true);
        await aliceElementApp.toggleRoomInfoPanel(); // should not be necessary, called in body of below
        await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);

        // Bob accepts the invite.
        await bobPage.getByRole("option", { name: "TestRoom2" }).click();
        await bobPage.getByRole("button", { name: "Accept" }).click();

        // Alice sends a message in the new room, which Bob should be able to decrypt.
        await sendMessageInCurrentRoom(alicePage, "Decryptable");
        await expect(bobPage.getByText("Decryptable")).toBeVisible();
    });

    test("setting per-room unverified blacklist toggle overrides global toggle", async ({
        page: alicePage,
        app: aliceElementApp,
        homeserver,
        browser,
        user: aliceCredentials,
        util,
    }, testInfo) => {
        await aliceElementApp.client.bootstrapCrossSigning(aliceCredentials);

        // Enable blacklist toggle.
        let dialog = await util.openEncryptionTab();
        const blacklistToggle = dialog.getByRole("switch", {
            name: "In encrypted rooms, only send messages to verified users",
        });
        await blacklistToggle.scrollIntoViewIfNeeded();
        await expect(blacklistToggle).toBeVisible();
        await blacklistToggle.click();
        await aliceElementApp.settings.closeDialog();

        // Create a second browser instance.
        const bobCredentials = await homeserver.registerUser(`user_${testInfo.testId}_bob`, "password", "bob");
        const bobPage = await createNewInstance(browser, bobCredentials, {});
        const bobElementApp = new ElementAppPage(bobPage);
        await bobElementApp.client.bootstrapCrossSigning(bobCredentials);

        // Alice creates the room and invite Bob.
        await createRoom(alicePage, "TestRoom", true);
        await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);

        // Bob accepts the invite.
        await bobPage.getByRole("option", { name: "TestRoom" }).click();
        await bobPage.getByRole("button", { name: "Accept" }).click();

        // Alice configures her client to allow sending to unverified users in this room.
        dialog = await aliceElementApp.settings.openRoomSettings("Security & Privacy");
        await dialog.getByRole("switch", { name: "Only send messages to verified users." }).click();
        await aliceElementApp.settings.closeDialog();

        // Alice sends a message which Bob should be able to decrypt.
        await sendMessageInCurrentRoom(alicePage, "Decryptable");
        await expect(bobPage.getByText("Decryptable")).toBeVisible();

        // Alice dismisses key storage warnings, as they now hide the "New conversation" button.
        await alicePage.getByRole("button", { name: "Dismiss" }).click(); // enable key storage
        await alicePage.getByRole("button", { name: "Yes, dismiss" }).click(); // enable key storage x2

        // Alice creates a second room and invites Bob.
        await createRoom(alicePage, "TestRoom2", true);
        await aliceElementApp.toggleRoomInfoPanel(); // should not be necessary, called in body of below
        await aliceElementApp.inviteUserToCurrentRoom(bobCredentials.userId);

        // Bob accepts the invite.
        await bobPage.getByRole("option", { name: "TestRoom2" }).click();
        await bobPage.getByRole("button", { name: "Accept" }).click();

        // Alice sends a message in the new room, which Bob should not be able to decrypt.
        await sendMessageInCurrentRoom(alicePage, "Undecryptable");
        await expect(
            bobPage.getByText(
                "The sender has blocked you from receiving this message because your device is unverified",
            ),
        ).toBeVisible();
    });
});
