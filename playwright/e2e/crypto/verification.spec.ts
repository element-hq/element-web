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

import jsQR from "jsqr";
import { type Preset, type Visibility } from "matrix-js-sdk/src/matrix";

import type { JSHandle, Locator, Page } from "@playwright/test";
import type { VerificationRequest, Verifier } from "matrix-js-sdk/src/crypto-api";
import { test, expect } from "../../element-web-test";
import {
    checkDeviceIsConnectedKeyBackup,
    checkDeviceIsCrossSigned,
    doTwoWaySasVerification,
    logIntoElement,
    waitForVerificationRequest,
} from "./utils";
import { Client } from "../../pages/client";
import { Bot } from "../../pages/bot";

test.describe("Device verification", () => {
    let aliceBotClient: Bot;

    /** The backup version that was set up by the bot client. */
    let expectedBackupVersion: string;

    test.beforeEach(async ({ page, homeserver, credentials }) => {
        // Visit the login page of the app, to load the matrix sdk
        await page.goto("/#/login");

        await page.pause();

        // wait for the page to load
        await page.waitForSelector(".mx_AuthPage", { timeout: 30000 });

        // Create a new device for alice
        aliceBotClient = new Bot(page, homeserver, {
            rustCrypto: true,
            bootstrapCrossSigning: true,
            bootstrapSecretStorage: true,
        });
        aliceBotClient.setCredentials(credentials);
        const mxClientHandle = await aliceBotClient.prepareClient();

        await page.waitForTimeout(20000);

        expectedBackupVersion = await mxClientHandle.evaluate(async (mxClient) => {
            return await mxClient.getCrypto()!.getActiveSessionBackupVersion();
        });
    });

    // Click the "Verify with another device" button, and have the bot client auto-accept it.
    async function initiateAliceVerificationRequest(page: Page): Promise<JSHandle<VerificationRequest>> {
        // alice bot waits for verification request
        const promiseVerificationRequest = waitForVerificationRequest(aliceBotClient);

        // Click on "Verify with another device"
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Verify with another device" }).click();

        // alice bot responds yes to verification request from alice
        return promiseVerificationRequest;
    }

    test("Verify device with SAS during login", async ({ page, app, credentials, homeserver }) => {
        await logIntoElement(page, homeserver, credentials);

        // Launch the verification request between alice and the bot
        const verificationRequest = await initiateAliceVerificationRequest(page);

        // Handle emoji SAS verification
        const infoDialog = page.locator(".mx_InfoDialog");
        // the bot chooses to do an emoji verification
        const verifier = await verificationRequest.evaluateHandle((request) => request.startVerification("m.sas.v1"));

        // Handle emoji request and check that emojis are matching
        await doTwoWaySasVerification(page, verifier);

        await infoDialog.getByRole("button", { name: "They match" }).click();
        await infoDialog.getByRole("button", { name: "Got it" }).click();

        // Check that our device is now cross-signed
        await checkDeviceIsCrossSigned(app);

        // Check that the current device is connected to key backup
        // For now we don't check that the backup key is in cache because it's a bit flaky,
        // as we need to wait for the secret gossiping to happen and the settings dialog doesn't refresh automatically.
        await checkDeviceIsConnectedKeyBackup(page, expectedBackupVersion, false);
    });

    test("Verify device with QR code during login", async ({ page, app, credentials, homeserver }) => {
        // A mode 0x02 verification: "self-verifying in which the current device does not yet trust the master key"
        await logIntoElement(page, homeserver, credentials);

        // Launch the verification request between alice and the bot
        const verificationRequest = await initiateAliceVerificationRequest(page);

        const infoDialog = page.locator(".mx_InfoDialog");
        // feed the QR code into the verification request.
        const qrData = await readQrCode(infoDialog);
        const verifier = await verificationRequest.evaluateHandle(
            (request, qrData) => request.scanQRCode(new Uint8Array(qrData)),
            [...qrData],
        );

        // Confirm that the bot user scanned successfully
        await expect(infoDialog.getByText("Almost there! Is your other device showing the same shield?")).toBeVisible();
        await infoDialog.getByRole("button", { name: "Yes" }).click();
        await infoDialog.getByRole("button", { name: "Got it" }).click();

        // wait for the bot to see we have finished
        await verifier.evaluate((verifier) => verifier.verify());

        // the bot uploads the signatures asynchronously, so wait for that to happen
        await page.waitForTimeout(1000);

        // our device should trust the bot device
        await app.client.evaluate(async (cli, aliceBotCredentials) => {
            const deviceStatus = await cli
                .getCrypto()!
                .getDeviceVerificationStatus(aliceBotCredentials.userId, aliceBotCredentials.deviceId);
            if (!deviceStatus.isVerified()) {
                throw new Error("Bot device was not verified after QR code verification");
            }
        }, aliceBotClient.credentials);

        // Check that our device is now cross-signed
        await checkDeviceIsCrossSigned(app);

        // Check that the current device is connected to key backup
        // For now we don't check that the backup key is in cache because it's a bit flaky,
        // as we need to wait for the secret gossiping to happen and the settings dialog doesn't refresh automatically.
        await checkDeviceIsConnectedKeyBackup(page, expectedBackupVersion, false);
    });

    test("Verify device with Security Phrase during login", async ({ page, app, credentials, homeserver }) => {
        await logIntoElement(page, homeserver, credentials);

        // Select the security phrase
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Verify with Security Key or Phrase" }).click();

        // Fill the passphrase
        const dialog = page.locator(".mx_Dialog");
        await dialog.locator("input").fill("new passphrase");
        await dialog.locator(".mx_Dialog_primary:not([disabled])", { hasText: "Continue" }).click();

        await page.locator(".mx_AuthPage").getByRole("button", { name: "Done" }).click();

        // Check that our device is now cross-signed
        await checkDeviceIsCrossSigned(app);

        // Check that the current device is connected to key backup
        // The backup decryption key should be in cache also, as we got it directly from the 4S
        await checkDeviceIsConnectedKeyBackup(page, expectedBackupVersion, true);
    });

    test("Verify device with Security Key during login", async ({ page, app, credentials, homeserver }) => {
        await logIntoElement(page, homeserver, credentials);

        // Select the security phrase
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Verify with Security Key or Phrase" }).click();

        // Fill the security key
        const dialog = page.locator(".mx_Dialog");
        await dialog.getByRole("button", { name: "use your Security Key" }).click();
        const aliceRecoveryKey = await aliceBotClient.getRecoveryKey();
        await dialog.locator("#mx_securityKey").fill(aliceRecoveryKey.encodedPrivateKey);
        await dialog.locator(".mx_Dialog_primary:not([disabled])", { hasText: "Continue" }).click();

        await page.locator(".mx_AuthPage").getByRole("button", { name: "Done" }).click();

        // Check that our device is now cross-signed
        await checkDeviceIsCrossSigned(app);

        // Check that the current device is connected to key backup
        // The backup decryption key should be in cache also, as we got it directly from the 4S
        await checkDeviceIsConnectedKeyBackup(page, expectedBackupVersion, true);
    });

    test("Handle incoming verification request with SAS", async ({ page, credentials, homeserver, toasts }) => {
        await logIntoElement(page, homeserver, credentials);

        /* Dismiss "Verify this device" */
        const authPage = page.locator(".mx_AuthPage");
        await authPage.getByRole("button", { name: "Skip verification for now" }).click();
        await authPage.getByRole("button", { name: "I'll verify later" }).click();

        await page.waitForSelector(".mx_MatrixChat");
        const elementDeviceId = await page.evaluate(() => window.mxMatrixClientPeg.get().getDeviceId());

        /* Now initiate a verification request from the *bot* device. */
        const botVerificationRequest = await aliceBotClient.evaluateHandle(
            async (client, { userId, deviceId }) => {
                return client.getCrypto()!.requestDeviceVerification(userId, deviceId);
            },
            { userId: credentials.userId, deviceId: elementDeviceId },
        );

        /* Check the toast for the incoming request */
        const toast = await toasts.getToast("Verification requested");
        // it should contain the device ID of the requesting device
        await expect(toast.getByText(`${aliceBotClient.credentials.deviceId} from `)).toBeVisible();
        // Accept
        await toast.getByRole("button", { name: "Verify Session" }).click();

        /* Click 'Start' to start SAS verification */
        await page.getByRole("button", { name: "Start" }).click();

        /* on the bot side, wait for the verifier to exist ... */
        const verifier = await awaitVerifier(botVerificationRequest);
        // ... confirm ...
        botVerificationRequest.evaluate((verificationRequest) => verificationRequest.verifier.verify());
        // ... and then check the emoji match
        await doTwoWaySasVerification(page, verifier);

        /* And we're all done! */
        const infoDialog = page.locator(".mx_InfoDialog");
        await infoDialog.getByRole("button", { name: "They match" }).click();
        await expect(
            infoDialog.getByText(`You've successfully verified (${aliceBotClient.credentials.deviceId})!`),
        ).toBeVisible();
        await infoDialog.getByRole("button", { name: "Got it" }).click();
    });
});

test.describe("User verification", () => {
    // note that there are other tests that check user verification works in `crypto.spec.ts`.

    test.use({
        displayName: "Alice",
        botCreateOpts: { displayName: "Bob", autoAcceptInvites: true, userIdPrefix: "bob_" },
    });

    test("can receive a verification request when there is no existing DM", async ({
        page,
        app,
        bot: bob,
        user: aliceCredentials,
        toasts,
    }) => {
        await app.client.bootstrapCrossSigning(aliceCredentials);

        // the other user creates a DM
        const dmRoomId = await createDMRoom(bob, aliceCredentials.userId);

        // accept the DM
        await app.viewRoomByName("Bob");
        await page.getByRole("button", { name: "Start chatting" }).click();

        // once Alice has joined, Bob starts the verification
        const bobVerificationRequest = await bob.evaluateHandle(
            async (client, { dmRoomId, aliceCredentials }) => {
                const room = client.getRoom(dmRoomId);
                while (room.getMember(aliceCredentials.userId)?.membership !== "join") {
                    await new Promise((resolve) => {
                        room.once(window.matrixcs.RoomStateEvent.Members, resolve);
                    });
                }

                return client.getCrypto().requestVerificationDM(aliceCredentials.userId, dmRoomId);
            },
            { dmRoomId, aliceCredentials },
        );

        // there should also be a toast
        const toast = await toasts.getToast("Verification requested");
        // it should contain the details of the requesting user
        await expect(toast.getByText(`Bob (${bob.credentials.userId})`)).toBeVisible();
        // Accept
        await toast.getByRole("button", { name: "Verify Session" }).click();

        // request verification by emoji
        await page.locator("#mx_RightPanel").getByRole("button", { name: "Verify by emoji" }).click();

        /* on the bot side, wait for the verifier to exist ... */
        const botVerifier = await awaitVerifier(bobVerificationRequest);
        // ... confirm ...
        botVerifier.evaluate((verifier) => verifier.verify());
        // ... and then check the emoji match
        await doTwoWaySasVerification(page, botVerifier);

        await page.getByRole("button", { name: "They match" }).click();
        await expect(page.getByText("You've successfully verified Bob!")).toBeVisible();
        await page.getByRole("button", { name: "Got it" }).click();
    });
});

/** Extract the qrcode out of an on-screen html element */
async function readQrCode(base: Locator) {
    const qrCode = base.locator('[alt="QR Code"]');
    const imageData = await qrCode.evaluate<
        {
            colorSpace: PredefinedColorSpace;
            width: number;
            height: number;
            buffer: number[];
        },
        HTMLImageElement
    >(async (img) => {
        // draw the image on a canvas
        const myCanvas = new OffscreenCanvas(img.width, img.height);
        const ctx = myCanvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // read the image data
        const imageData = ctx.getImageData(0, 0, myCanvas.width, myCanvas.height);
        return {
            colorSpace: imageData.colorSpace,
            width: imageData.width,
            height: imageData.height,
            buffer: [...new Uint8ClampedArray(imageData.data.buffer)],
        };
    });

    // now we can decode the QR code.
    const result = jsQR(new Uint8ClampedArray(imageData.buffer), imageData.width, imageData.height);
    return new Uint8Array(result.binaryData);
}

async function createDMRoom(client: Client, userId: string): Promise<string> {
    return client.createRoom({
        preset: "trusted_private_chat" as Preset,
        visibility: "private" as Visibility,
        invite: [userId],
        is_direct: true,
        initial_state: [
            {
                type: "m.room.encryption",
                state_key: "",
                content: {
                    algorithm: "m.megolm.v1.aes-sha2",
                },
            },
        ],
    });
}

/**
 * Wait for a verifier to exist for a VerificationRequest
 *
 * @param botVerificationRequest
 */
async function awaitVerifier(botVerificationRequest: JSHandle<VerificationRequest>): Promise<JSHandle<Verifier>> {
    return botVerificationRequest.evaluateHandle(async (verificationRequest) => {
        while (!verificationRequest.verifier) {
            await new Promise((r) => verificationRequest.once("change" as any, r));
        }
        return verificationRequest.verifier;
    });
}
