/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, type JSHandle, type Page } from "@playwright/test";

import type { ICreateRoomOpts, MatrixClient } from "matrix-js-sdk/src/matrix";
import type {
    CryptoEvent,
    EmojiMapping,
    GeneratedSecretStorageKey,
    ShowSasCallbacks,
    VerificationRequest,
    Verifier,
    VerifierEvent,
} from "matrix-js-sdk/src/crypto-api";
import { type Credentials, type HomeserverInstance } from "../../plugins/homeserver";
import { type Client } from "../../pages/client";
import { type ElementAppPage } from "../../pages/ElementAppPage";
import { Bot } from "../../pages/bot";

/**
 * Create a bot client using the supplied credentials, and wait for the key backup to be ready.
 * @param page - the playwright `page` fixture
 * @param homeserver - the homeserver to use
 * @param credentials - the credentials to use for the bot client
 * @param usePassphrase - whether to use a passphrase when creating the recovery key
 */
export async function createBot(
    page: Page,
    homeserver: HomeserverInstance,
    credentials: Credentials,
    usePassphrase = false,
): Promise<{ botClient: Bot; recoveryKey: GeneratedSecretStorageKey; expectedBackupVersion: string }> {
    // Visit the login page of the app, to load the matrix sdk
    await page.goto("/#/login");

    // wait for the page to load
    await page.waitForSelector(".mx_AuthPage", { timeout: 30000 });

    // Create a new bot client
    const botClient = new Bot(page, homeserver, {
        bootstrapCrossSigning: true,
        bootstrapSecretStorage: true,
        usePassphrase,
    });
    botClient.setCredentials(credentials);
    // Backup is prepared in the background. Poll until it is ready.
    const botClientHandle = await botClient.prepareClient();
    let expectedBackupVersion: string;
    await expect
        .poll(async () => {
            expectedBackupVersion = await botClientHandle.evaluate((cli) =>
                cli.getCrypto()!.getActiveSessionBackupVersion(),
            );
            return expectedBackupVersion;
        })
        .not.toBe(null);

    const recoveryKey = await botClient.getRecoveryKey();

    return { botClient, recoveryKey, expectedBackupVersion };
}

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
                void event.confirm();
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
 * @param app -` ElementAppPage` wrapper for the playwright `Page`.
 * @param expectedBackupVersion - the version of the backup we expect to be connected to.
 * @param checkBackupPrivateKeyInCache - whether to check that the backup decryption key is cached locally
 */
export async function checkDeviceIsConnectedKeyBackup(
    app: ElementAppPage,
    expectedBackupVersion: string,
    checkBackupPrivateKeyInCache: boolean,
): Promise<void> {
    // Sanity check the given backup version: if it's null, something went wrong earlier in the test.
    if (!expectedBackupVersion) {
        throw new Error(
            `Invalid backup version passed to \`checkDeviceIsConnectedKeyBackup\`: ${expectedBackupVersion}`,
        );
    }

    const backupData = await app.client.evaluate(async (client: MatrixClient) => {
        const crypto = client.getCrypto();
        if (!crypto) return;

        const backupInfo = await crypto.getKeyBackupInfo();
        const backupKeyIn4S = Boolean(await client.isKeyBackupKeyStored());
        const backupPrivateKeyFromCache = await crypto.getSessionBackupPrivateKey();
        const hasBackupPrivateKeyFromCache = Boolean(backupPrivateKeyFromCache);
        const backupPrivateKeyWellFormed = backupPrivateKeyFromCache instanceof Uint8Array;
        const activeBackupVersion = await crypto.getActiveSessionBackupVersion();

        return {
            backupInfo,
            hasBackupPrivateKeyFromCache,
            backupPrivateKeyWellFormed,
            backupKeyIn4S,
            activeBackupVersion,
        };
    });

    if (!backupData) {
        throw new Error("Crypto module is not available");
    }

    const { backupInfo, backupKeyIn4S, hasBackupPrivateKeyFromCache, backupPrivateKeyWellFormed, activeBackupVersion } =
        backupData;

    // We have a key backup
    expect(backupInfo).toBeDefined();
    // The key backup version is as expected
    expect(backupInfo.version).toBe(expectedBackupVersion);
    // The active backup version is as expected
    expect(activeBackupVersion).toBe(expectedBackupVersion);
    // The backup key is stored in 4S
    expect(backupKeyIn4S).toBe(true);

    if (checkBackupPrivateKeyInCache) {
        // The backup key is available locally
        expect(hasBackupPrivateKeyFromCache).toBe(true);
        // The backup key is well-formed
        expect(backupPrivateKeyWellFormed).toBe(true);
    }
}

/**
 * Fill in the login form in element with the given creds.
 *
 * If a `securityKey` is given, verifies the new device using the key.
 */
export async function logIntoElement(page: Page, credentials: Credentials, securityKey?: string) {
    await page.goto("/#/login");

    await page.getByRole("textbox", { name: "Username" }).fill(credentials.userId);
    await page.getByPlaceholder("Password").fill(credentials.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // if a securityKey was given, verify the new device
    if (securityKey !== undefined) {
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Verify with Security Key" }).click();

        const useSecurityKey = page.locator(".mx_Dialog").getByRole("button", { name: "use your Security Key" });
        if (await useSecurityKey.isVisible()) {
            await useSecurityKey.click();
        }
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
 * Open the encryption settings, and verify the current session using the security key.
 *
 * @param app - `ElementAppPage` wrapper for the playwright `Page`.
 * @param securityKey - The security key (i.e., 4S key), set up during a previous session.
 */
export async function verifySession(app: ElementAppPage, securityKey: string) {
    const settings = await app.settings.openUserSettings("Encryption");
    await settings.getByRole("button", { name: "Verify this device" }).click();
    await app.page.getByRole("button", { name: "Verify with Security Key" }).click();
    await app.page.locator(".mx_Dialog").locator('input[type="password"]').fill(securityKey);
    await app.page.getByRole("button", { name: "Continue", disabled: false }).click();
    await app.page.getByRole("button", { name: "Done" }).click();
    await app.settings.closeDialog();
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
        await expect(emojiBlock).toHaveText(emoji[0] + emoji[1]);
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

    return await completeCreateSecretStorageDialog(app.page);
}

/**
 * Go through the "Set up Secure Backup" dialog (aka the `CreateSecretStorageDialog`).
 *
 * Assumes the dialog is already open for some reason (see also {@link enableKeyBackup}).
 *
 * @param page - The playwright `Page` fixture.
 * @param opts - Options object
 * @param opts.accountPassword - The user's account password. If we are also resetting cross-signing, then we will need
 *   to upload the public cross-signing keys, which will cause the app to prompt for the password.
 *
 * @returns the new recovery key.
 */
export async function completeCreateSecretStorageDialog(
    page: Page,
    opts?: { accountPassword?: string },
): Promise<string> {
    const currentDialogLocator = page.locator(".mx_Dialog");

    await expect(currentDialogLocator.getByRole("heading", { name: "Set up Secure Backup" })).toBeVisible();
    // "Generate a Security Key" is selected by default
    await currentDialogLocator.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(currentDialogLocator.getByRole("heading", { name: "Save your Security Key" })).toBeVisible();
    await currentDialogLocator.getByRole("button", { name: "Copy", exact: true }).click();
    // copy the recovery key to use it later
    const recoveryKey = await page.evaluate(() => navigator.clipboard.readText());
    await currentDialogLocator.getByRole("button", { name: "Continue", exact: true }).click();

    // If the device is unverified, there should be a "Setting up keys" step.
    // If this is not the first time we are setting up cross-signing, the app will prompt for our password; otherwise
    // the step is quite quick, and playwright can miss it, so we can't test for it.
    if (opts && Object.hasOwn(opts, "accountPassword")) {
        await expect(currentDialogLocator.getByRole("heading", { name: "Setting up keys" })).toBeVisible();
        await page.getByPlaceholder("Password").fill(opts!.accountPassword);
        await currentDialogLocator.getByRole("button", { name: "Continue" }).click();
    }

    // Either way, we end up at a success dialog:
    await expect(currentDialogLocator.getByRole("heading", { name: "Secure Backup successful" })).toBeVisible();
    await currentDialogLocator.getByRole("button", { name: "Done", exact: true }).click();
    await expect(currentDialogLocator.getByText("Secure Backup successful")).not.toBeVisible();

    return recoveryKey;
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
                void cli.joinRoom(member.roomId);
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
    await page.locator(".mx_RightPanel").getByRole("menuitem", { name: "People" }).click();
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

/** Log in a second device for the given bot user */
export async function createSecondBotDevice(page: Page, homeserver: HomeserverInstance, bob: Bot) {
    const bobSecondDevice = new Bot(page, homeserver, {
        bootstrapSecretStorage: false,
        bootstrapCrossSigning: false,
    });
    bobSecondDevice.setCredentials(await homeserver.loginUser(bob.credentials.userId, bob.credentials.password));
    await bobSecondDevice.prepareClient();
    return bobSecondDevice;
}

/**
 * Remove the cached secrets from the indexedDB
 * This is a workaround to simulate the case where the secrets are not cached.
 */
export async function deleteCachedSecrets(page: Page) {
    await page.evaluate(async () => {
        const removeCachedSecrets = new Promise((resolve) => {
            const request = window.indexedDB.open("matrix-js-sdk::matrix-sdk-crypto");
            request.onsuccess = (event: Event & { target: { result: IDBDatabase } }) => {
                const db = event.target.result;
                const request = db.transaction("core", "readwrite").objectStore("core").delete("private_identity");
                request.onsuccess = () => {
                    db.close();
                    resolve(undefined);
                };
            };
        });
        await removeCachedSecrets;
    });
    await page.reload();
}
