/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { expect, JSHandle, type Page } from "@playwright/test";

import type { CryptoEvent, ICreateRoomOpts, MatrixClient } from "matrix-js-sdk/src/matrix";
import type {
    EmojiMapping,
    ShowSasCallbacks,
    VerificationRequest,
    Verifier,
    VerifierEvent,
} from "matrix-js-sdk/src/crypto-api";
import { Credentials, HomeserverInstance } from "../../plugins/homeserver";
import { Client } from "../../pages/client";
import { ElementAppPage } from "../../pages/ElementAppPage";
import { Bot } from "../../pages/bot";

/**
 * wait for the given client to receive an incoming verification request, and automatically accept it
 *
 * @param client - matrix client handle we expect to receive a request
 */
export async function waitForVerificationRequest(client: Client): Promise<JSHandle<VerificationRequest>> {
    return client.evaluateHandle((cli) => {
        return new Promise<VerificationRequest>((resolve) => {
            const onVerificationRequestEvent = async (request: VerificationRequest) => {
                await request.accept();
                resolve(request);
            };
            cli.once(
                "crypto.verificationRequestReceived" as CryptoEvent.VerificationRequestReceived,
                onVerificationRequestEvent,
            );
        });
    });
}

/**
 * Automatically handle a SAS verification
 *
 * Given a verifier which has already been started, wait for the emojis to be received, blindly confirm they
 * match, and return them
 *
 * @param verifier - verifier
 * @returns A promise that resolves, with the emoji list, once we confirm the emojis
 */
export function handleSasVerification(verifier: JSHandle<Verifier>): Promise<EmojiMapping[]> {
    return verifier.evaluate((verifier) => {
        const event = verifier.getShowSasCallbacks();
        if (event) return event.sas.emoji;

        return new Promise<EmojiMapping[]>((resolve) => {
            const onShowSas = (event: ShowSasCallbacks) => {
                verifier.off("show_sas" as VerifierEvent, onShowSas);
                event.confirm();
                resolve(event.sas.emoji);
            };

            verifier.on("show_sas" as VerifierEvent, onShowSas);
        });
    });
}

/**
 * Check that the user has published cross-signing keys, and that the user's device has been cross-signed.
 */
export async function checkDeviceIsCrossSigned(app: ElementAppPage): Promise<void> {
    const { userId, deviceId, keys } = await app.client.evaluate(async (cli: MatrixClient) => {
        const deviceId = cli.getDeviceId();
        const userId = cli.getUserId();
        const keys = await cli.downloadKeysForUsers([userId]);

        return { userId, deviceId, keys };
    });

    // there should be three cross-signing keys
    expect(keys.master_keys[userId]).toHaveProperty("keys");
    expect(keys.self_signing_keys[userId]).toHaveProperty("keys");
    expect(keys.user_signing_keys[userId]).toHaveProperty("keys");

    // and the device should be signed by the self-signing key
    const selfSigningKeyId = Object.keys(keys.self_signing_keys[userId].keys)[0];

    expect(keys.device_keys[userId][deviceId]).toBeDefined();

    const myDeviceSignatures = keys.device_keys[userId][deviceId].signatures[userId];
    expect(myDeviceSignatures[selfSigningKeyId]).toBeDefined();
}

/**
 * Check that the current device is connected to the expected key backup.
 * Also checks that the decryption key is known and cached locally.
 *
 * @param page - the page to check
 * @param expectedBackupVersion - the version of the backup we expect to be connected to.
 * @param checkBackupKeyInCache - whether to check that the backup key is cached locally.
 */
export async function checkDeviceIsConnectedKeyBackup(
    page: Page,
    expectedBackupVersion: string,
    checkBackupKeyInCache: boolean,
): Promise<void> {
    // Sanity check the given backup version: if it's null, something went wrong earlier in the test.
    if (!expectedBackupVersion) {
        throw new Error(
            `Invalid backup version passed to \`checkDeviceIsConnectedKeyBackup\`: ${expectedBackupVersion}`,
        );
    }

    await page.getByRole("button", { name: "User menu" }).click();
    await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Security & Privacy" }).click();
    await expect(page.locator(".mx_Dialog").getByRole("button", { name: "Restore from Backup" })).toBeVisible();

    // expand the advanced section to see the active version in the reports
    await page.locator(".mx_SecureBackupPanel_advanced").locator("..").click();

    if (checkBackupKeyInCache) {
        const cacheDecryptionKeyStatusElement = page.locator(".mx_SecureBackupPanel_statusList tr:nth-child(2) td");
        await expect(cacheDecryptionKeyStatusElement).toHaveText("cached locally, well formed");
    }

    await expect(page.locator(".mx_SecureBackupPanel_statusList tr:nth-child(5) td")).toHaveText(
        expectedBackupVersion + " (Algorithm: m.megolm_backup.v1.curve25519-aes-sha2)",
    );

    await expect(page.locator(".mx_SecureBackupPanel_statusList tr:nth-child(6) td")).toHaveText(expectedBackupVersion);
}

/**
 * Fill in the login form in element with the given creds.
 *
 * If a `securityKey` is given, verifies the new device using the key.
 */
export async function logIntoElement(
    page: Page,
    homeserver: HomeserverInstance,
    credentials: Credentials,
    securityKey?: string,
) {
    await page.goto("/#/login");

    // select homeserver
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Other homeserver" }).fill(homeserver.config.baseUrl);
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // wait for the dialog to go away
    await expect(page.locator(".mx_ServerPickerDialog")).not.toBeVisible();

    await page.getByRole("textbox", { name: "Username" }).fill(credentials.userId);
    await page.getByPlaceholder("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // if a securityKey was given, verify the new device
    if (securityKey !== undefined) {
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Verify with Security Key" }).click();
        // Fill in the security key
        await page.locator(".mx_Dialog").locator('input[type="password"]').fill(securityKey);
        await page.locator(".mx_Dialog_primary:not([disabled])", { hasText: "Continue" }).click();
        await page.getByRole("button", { name: "Done" }).click();
    }
}

/**
 * Click the "sign out" option in Element, and wait for the login page to load
 *
 * @param page - Playwright `Page` object.
 * @param discardKeys - if true, expect a "You'll lose access to your encrypted messages" dialog, and dismiss it.
 */
export async function logOutOfElement(page: Page, discardKeys: boolean = false) {
    await page.getByRole("button", { name: "User menu" }).click();
    await page.locator(".mx_UserMenu_contextMenu").getByRole("menuitem", { name: "Sign out" }).click();
    if (discardKeys) {
        await page.getByRole("button", { name: "I don't want my encrypted messages" }).click();
    } else {
        await page.locator(".mx_Dialog .mx_QuestionDialog").getByRole("button", { name: "Sign out" }).click();
    }

    // Wait for the login page to load
    await page.getByRole("heading", { name: "Sign in" }).click();
}

/**
 * Open the security settings, and verify the current session using the security key.
 *
 * @param app - `ElementAppPage` wrapper for the playwright `Page`.
 * @param securityKey - The security key (i.e., 4S key), set up during a previous session.
 */
export async function verifySession(app: ElementAppPage, securityKey: string) {
    const settings = await app.settings.openUserSettings("Security & Privacy");
    await settings.getByRole("button", { name: "Verify this session" }).click();
    await app.page.getByRole("button", { name: "Verify with Security Key" }).click();
    await app.page.locator(".mx_Dialog").locator('input[type="password"]').fill(securityKey);
    await app.page.getByRole("button", { name: "Continue", disabled: false }).click();
    await app.page.getByRole("button", { name: "Done" }).click();
}

/**
 * Given a SAS verifier for a bot client:
 *   - wait for the bot to receive the emojis
 *   - check that the bot sees the same emoji as the application
 *
 * @param verifier - a verifier in a bot client
 */
export async function doTwoWaySasVerification(page: Page, verifier: JSHandle<Verifier>): Promise<void> {
    // on the bot side, wait for the emojis, confirm they match, and return them
    const emojis = await handleSasVerification(verifier);

    const emojiBlocks = page.locator(".mx_VerificationShowSas_emojiSas_block");
    await expect(emojiBlocks).toHaveCount(emojis.length);

    // then, check that our application shows an emoji panel with the same emojis.
    for (let i = 0; i < emojis.length; i++) {
        const emoji = emojis[i];
        const emojiBlock = emojiBlocks.nth(i);
        const textContent = await emojiBlock.textContent();
        // VerificationShowSas munges the case of the emoji descriptions returned by the js-sdk before
        // displaying them. Once we drop support for legacy crypto, that code can go away, and so can the
        // case-munging here.
        expect(textContent.toLowerCase()).toEqual(emoji[0] + emoji[1].toLowerCase());
    }
}

/**
 * Open the security settings and enable secure key backup.
 *
 * Assumes that the current device has been cross-signed (which means that we skip a step where we set it up).
 *
 * Returns the security key
 */
export async function enableKeyBackup(app: ElementAppPage): Promise<string> {
    await app.settings.openUserSettings("Security & Privacy");
    await app.page.getByRole("button", { name: "Set up Secure Backup" }).click();
    const dialog = app.page.locator(".mx_Dialog");
    // Recovery key is selected by default
    await dialog.getByRole("button", { name: "Continue" }).click({ timeout: 60000 });

    // copy the text ourselves
    const securityKey = await dialog.locator(".mx_CreateSecretStorageDialog_recoveryKey code").textContent();
    await copyAndContinue(app.page);

    await expect(dialog.getByText("Secure Backup successful")).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog.getByText("Secure Backup successful")).not.toBeVisible();

    return securityKey;
}

/**
 * Click on copy and continue buttons to dismiss the security key dialog
 */
export async function copyAndContinue(page: Page) {
    await page.getByRole("button", { name: "Copy" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
}

/**
 * Create a shared, unencrypted room with the given user, and wait for them to join
 *
 * @param other - UserID of the other user
 * @param opts - other options for the createRoom call
 *
 * @returns a promise which resolves to the room ID
 */
export async function createSharedRoomWithUser(
    app: ElementAppPage,
    other: string,
    opts: Omit<ICreateRoomOpts, "invite"> = { name: "TestRoom" },
): Promise<string> {
    const roomId = await app.client.createRoom({ ...opts, invite: [other] });

    await app.viewRoomById(roomId);

    // wait for the other user to join the room, otherwise our attempt to open his user details may race
    // with his join.
    await expect(app.page.getByText(" joined the room", { exact: false })).toBeVisible();

    return roomId;
}

/**
 * Send a message in the current room
 * @param page
 * @param message - The message text to send
 */
export async function sendMessageInCurrentRoom(page: Page, message: string): Promise<void> {
    await page.locator(".mx_MessageComposer").getByRole("textbox").fill(message);
    await page.getByTestId("sendmessagebtn").click();
}

/**
 * Create a room with the given name and encryption status using the room creation dialog.
 *
 * @param roomName - The name of the room to create
 * @param isEncrypted - Whether the room should be encrypted
 */
export async function createRoom(page: Page, roomName: string, isEncrypted: boolean): Promise<void> {
    await page.getByRole("button", { name: "Add room" }).click();
    await page.locator(".mx_IconizedContextMenu").getByRole("menuitem", { name: "New room" }).click();

    const dialog = page.locator(".mx_Dialog");

    await dialog.getByLabel("Name").fill(roomName);

    if (!isEncrypted) {
        // it's enabled by default
        await page.getByLabel("Enable end-to-end encryption").click();
    }

    await dialog.getByRole("button", { name: "Create room" }).click();

    // Wait for the client to process the encryption event before carrying on (and potentially sending events).
    if (isEncrypted) {
        await expect(page.getByText("Encryption enabled")).toBeVisible();
    }
}

/**
 * Configure the given MatrixClient to auto-accept any invites
 * @param client - the client to configure
 */
export async function autoJoin(client: Client) {
    await client.evaluate((cli) => {
        cli.on(window.matrixcs.RoomMemberEvent.Membership, (event, member) => {
            if (member.membership === "invite" && member.userId === cli.getUserId()) {
                cli.joinRoom(member.roomId);
            }
        });
    });
}

/**
 * Verify a user by emoji
 * @param page - the page to use
 * @param bob - the user to verify
 */
export const verify = async (app: ElementAppPage, bob: Bot) => {
    const page = app.page;
    const bobsVerificationRequestPromise = waitForVerificationRequest(bob);

    const roomInfo = await app.toggleRoomInfoPanel();
    await page.locator(".mx_RightPanelTabs").getByText("People").click();
    await roomInfo.getByText("Bob").click();
    await roomInfo.getByRole("button", { name: "Verify" }).click();
    await roomInfo.getByRole("button", { name: "Start Verification" }).click();

    // this requires creating a DM, so can take a while. Give it a longer timeout.
    await roomInfo.getByRole("button", { name: "Verify by emoji" }).click({ timeout: 30000 });

    const request = await bobsVerificationRequestPromise;
    // the bot user races with the Element user to hit the "verify by emoji" button
    const verifier = await request.evaluateHandle((request) => request.startVerification("m.sas.v1"));
    await doTwoWaySasVerification(page, verifier);
    await roomInfo.getByRole("button", { name: "They match" }).click();
    await expect(roomInfo.getByText("You've successfully verified Bob!")).toBeVisible();
    await roomInfo.getByRole("button", { name: "Got it" }).click();
};

/**
 * Wait for a verifier to exist for a VerificationRequest
 *
 * @param botVerificationRequest
 */
export async function awaitVerifier(
    botVerificationRequest: JSHandle<VerificationRequest>,
): Promise<JSHandle<Verifier>> {
    return botVerificationRequest.evaluateHandle(async (verificationRequest) => {
        while (!verificationRequest.verifier) {
            await new Promise((r) => verificationRequest.once("change" as any, r));
        }
        return verificationRequest.verifier;
    });
}
