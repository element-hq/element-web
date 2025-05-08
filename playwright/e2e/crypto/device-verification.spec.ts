/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import jsQR from "jsqr";

import type { JSHandle, Locator, Page } from "@playwright/test";
import type { VerificationRequest } from "matrix-js-sdk/src/crypto-api";
import { test, expect } from "../../element-web-test";
import {
    awaitVerifier,
    checkDeviceIsConnectedKeyBackup,
    checkDeviceIsCrossSigned,
    createBot,
    doTwoWaySasVerification,
    logIntoElement,
    waitForVerificationRequest,
} from "./utils";
import { type Bot } from "../../pages/bot";
import { Toasts } from "../../pages/toasts.ts";

test.describe("Device verification", { tag: "@no-webkit" }, () => {
    let aliceBotClient: Bot;

    /** The backup version that was set up by the bot client. */
    let expectedBackupVersion: string;

    test.beforeEach(async ({ page, homeserver, credentials }) => {
        const res = await createBot(page, homeserver, credentials, true);
        aliceBotClient = res.botClient;
        expectedBackupVersion = res.expectedBackupVersion;
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
        await logIntoElement(page, credentials);

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
        // as we need to wait for the secret gossiping to happen.
        await checkDeviceIsConnectedKeyBackup(app, expectedBackupVersion, false);
    });

    // Regression test for https://github.com/element-hq/element-web/issues/29110
    test("No toast after verification, even if the secrets take a while to arrive", async ({ page, credentials }) => {
        // Before we log in, the bot creates an encrypted room, so that we can test the toast behaviour that only happens
        // when we are in an encrypted room.
        await aliceBotClient.createRoom({
            initial_state: [
                {
                    type: "m.room.encryption",
                    state_key: "",
                    content: { algorithm: "m.megolm.v1.aes-sha2" },
                },
            ],
        });

        // In order to simulate a real environment more accurately, we need to slow down the arrival of the
        // `m.secret.send` to-device messages. That's slightly tricky to do directly, so instead we delay the *outgoing*
        // `m.secret.request` messages.
        await page.route("**/_matrix/client/v3/sendToDevice/m.secret.request/**", async (route) => {
            await route.fulfill({ json: {} });
            await new Promise((f) => setTimeout(f, 1000));
            await route.fetch();
        });

        await logIntoElement(page, credentials);

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

        // There should be no toast (other than the notifications one)
        const toasts = new Toasts(page);
        await toasts.rejectToast("Notifications");
        await toasts.assertNoToasts();
    });

    test("Verify device with QR code during login", async ({ page, app, credentials, homeserver }) => {
        // A mode 0x02 verification: "self-verifying in which the current device does not yet trust the master key"
        await logIntoElement(page, credentials);

        // Launch the verification request between alice and the bot
        const verificationRequest = await initiateAliceVerificationRequest(page);

        const infoDialog = page.locator(".mx_InfoDialog");
        // feed the QR code into the verification request.
        const qrData = await readQrCode(infoDialog);
        const verifier = await verificationRequest.evaluateHandle(
            (request, qrData) => request.scanQRCode(new Uint8ClampedArray(qrData)),
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
        await checkDeviceIsConnectedKeyBackup(app, expectedBackupVersion, true);
    });

    test("Verify device with Security Phrase during login", async ({ page, app, credentials, homeserver }) => {
        await logIntoElement(page, credentials);

        // Select the security phrase
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Verify with Recovery Key or Phrase" }).click();

        // Fill the passphrase
        const dialog = page.locator(".mx_Dialog");
        await dialog.locator("input").fill("new passphrase");
        await dialog.locator(".mx_Dialog_primary:not([disabled])", { hasText: "Continue" }).click();

        await page.locator(".mx_AuthPage").getByRole("button", { name: "Done" }).click();

        // Check that our device is now cross-signed
        await checkDeviceIsCrossSigned(app);

        // Check that the current device is connected to key backup
        // The backup decryption key should be in cache also, as we got it directly from the 4S
        await checkDeviceIsConnectedKeyBackup(app, expectedBackupVersion, true);
    });

    test("Verify device with Recovery Key during login", async ({ page, app, credentials, homeserver }) => {
        await logIntoElement(page, credentials);

        // Select the security phrase
        await page.locator(".mx_AuthPage").getByRole("button", { name: "Verify with Recovery Key or Phrase" }).click();

        // Fill the recovery key
        const dialog = page.locator(".mx_Dialog");
        await dialog.getByRole("button", { name: "use your Recovery Key" }).click();
        const aliceRecoveryKey = await aliceBotClient.getRecoveryKey();
        await dialog.locator("#mx_securityKey").fill(aliceRecoveryKey.encodedPrivateKey);
        await dialog.locator(".mx_Dialog_primary:not([disabled])", { hasText: "Continue" }).click();

        await page.locator(".mx_AuthPage").getByRole("button", { name: "Done" }).click();

        // Check that our device is now cross-signed
        await checkDeviceIsCrossSigned(app);

        // Check that the current device is connected to key backup
        // The backup decryption key should be in cache also, as we got it directly from the 4S
        await checkDeviceIsConnectedKeyBackup(app, expectedBackupVersion, true);
    });

    test("Handle incoming verification request with SAS", async ({ page, credentials, homeserver, toasts }) => {
        await logIntoElement(page, credentials);

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
        void botVerificationRequest.evaluate((verificationRequest) => verificationRequest.verifier.verify());
        // ... and then check the emoji match
        await doTwoWaySasVerification(page, verifier);

        /* And we're all done! */
        const infoDialog = page.locator(".mx_InfoDialog");
        await infoDialog.getByRole("button", { name: "They match" }).click();
        // We don't assert the full string as the device name is unset on Synapse but set to the user ID on Dendrite
        await expect(infoDialog.getByText(`You've successfully verified`)).toContainText(
            `(${aliceBotClient.credentials.deviceId})`,
        );
        await infoDialog.getByRole("button", { name: "Got it" }).click();
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
