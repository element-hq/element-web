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

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import type { VerificationRequest, Verifier } from "matrix-js-sdk/src/crypto-api";
import { CypressBot } from "../../support/bot";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { emitPromise } from "../../support/util";
import {
    checkDeviceIsConnectedKeyBackup,
    checkDeviceIsCrossSigned,
    doTwoWaySasVerification,
    logIntoElement,
    waitForVerificationRequest,
} from "./utils";
import { getToast } from "../../support/toasts";
import { UserCredentials } from "../../support/login";

/** Render a data URL and return the rendered image data */
async function renderQRCode(dataUrl: string): Promise<ImageData> {
    // create a new image and set the source to the data url
    const img = new Image();
    await new Promise((r) => {
        img.onload = r;
        img.src = dataUrl;
    });

    // draw the image on a canvas
    const myCanvas = new OffscreenCanvas(256, 256);
    const ctx = myCanvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    // read the image data
    return ctx.getImageData(0, 0, myCanvas.width, myCanvas.height);
}

describe("Device verification", () => {
    let aliceBotClient: CypressBot;
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.startHomeserver("default").then((data: HomeserverInstance) => {
            homeserver = data;

            // Visit the login page of the app, to load the matrix sdk
            cy.visit("/#/login");

            // wait for the page to load
            cy.window({ log: false }).should("have.property", "matrixcs");

            // Create a new device for alice
            cy.getBot(homeserver, {
                rustCrypto: true,
                bootstrapCrossSigning: true,
                bootstrapSecretStorage: true,
            }).then((bot) => {
                aliceBotClient = bot;
            });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    /* Click the "Verify with another device" button, and have the bot client auto-accept it.
     *
     * Stores the incoming `VerificationRequest` on the bot client as `@verificationRequest`.
     */
    function initiateAliceVerificationRequest() {
        // alice bot waits for verification request
        const promiseVerificationRequest = waitForVerificationRequest(aliceBotClient);

        // Click on "Verify with another device"
        cy.get(".mx_AuthPage").within(() => {
            cy.findByRole("button", { name: "Verify with another device" }).click();
        });

        // alice bot responds yes to verification request from alice
        cy.wrap(promiseVerificationRequest).as("verificationRequest");
    }

    it("Verify device during login with SAS", () => {
        logIntoElement(homeserver.baseUrl, aliceBotClient.getUserId(), aliceBotClient.__cypress_password);

        // Launch the verification request between alice and the bot
        initiateAliceVerificationRequest();

        // Handle emoji SAS verification
        cy.get(".mx_InfoDialog").within(() => {
            cy.get<VerificationRequest>("@verificationRequest").then(async (request: VerificationRequest) => {
                // the bot chooses to do an emoji verification
                const verifier = await request.startVerification("m.sas.v1");

                // Handle emoji request and check that emojis are matching
                doTwoWaySasVerification(verifier);
            });

            cy.findByRole("button", { name: "They match" }).click();
            cy.findByRole("button", { name: "Got it" }).click();
        });

        // Check that our device is now cross-signed
        checkDeviceIsCrossSigned();

        // Check that the current device is connected to key backup
        checkDeviceIsConnectedKeyBackup();
    });

    it("Verify device during login with QR code", () => {
        logIntoElement(homeserver.baseUrl, aliceBotClient.getUserId(), aliceBotClient.__cypress_password);

        // Launch the verification request between alice and the bot
        initiateAliceVerificationRequest();

        cy.get(".mx_InfoDialog").within(() => {
            cy.get('[alt="QR Code"]').then((qrCode) => {
                /* the bot scans the QR code */
                cy.get<VerificationRequest>("@verificationRequest")
                    .then(async (request: VerificationRequest) => {
                        // feed the QR code into the verification request.
                        const qrData = await readQrCode(qrCode);
                        return await request.scanQRCode(qrData);
                    })
                    .as("verifier");
            });

            // Confirm that the bot user scanned successfully
            cy.findByText("Almost there! Is your other device showing the same shield?");
            cy.findByRole("button", { name: "Yes" }).click();

            cy.findByRole("button", { name: "Got it" }).click();
        });

        // wait for the bot to see we have finished
        cy.get<Verifier>("@verifier").then(async (verifier) => {
            await verifier.verify();
        });

        // the bot uploads the signatures asynchronously, so wait for that to happen
        cy.wait(1000);

        // Check that our device is now cross-signed
        checkDeviceIsCrossSigned();

        // Check that the current device is connected to key backup
        checkDeviceIsConnectedKeyBackup();
    });

    it("Verify device during login with Security Phrase", () => {
        logIntoElement(homeserver.baseUrl, aliceBotClient.getUserId(), aliceBotClient.__cypress_password);

        // Select the security phrase
        cy.get(".mx_AuthPage").within(() => {
            cy.findByRole("button", { name: "Verify with Security Key or Phrase" }).click();
        });

        // Fill the passphrase
        cy.get(".mx_Dialog").within(() => {
            cy.get("input").type("new passphrase");
            cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();
        });

        cy.get(".mx_AuthPage").within(() => {
            cy.findByRole("button", { name: "Done" }).click();
        });

        // Check that our device is now cross-signed
        checkDeviceIsCrossSigned();

        // Check that the current device is connected to key backup
        checkDeviceIsConnectedKeyBackup();
    });

    it("Verify device during login with Security Key", () => {
        logIntoElement(homeserver.baseUrl, aliceBotClient.getUserId(), aliceBotClient.__cypress_password);

        // Select the security phrase
        cy.get(".mx_AuthPage").within(() => {
            cy.findByRole("button", { name: "Verify with Security Key or Phrase" }).click();
        });

        // Fill the security key
        cy.get(".mx_Dialog").within(() => {
            cy.findByRole("button", { name: "use your Security Key" }).click();
            cy.get("#mx_securityKey").type(aliceBotClient.__cypress_recovery_key.encodedPrivateKey);
            cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();
        });

        cy.get(".mx_AuthPage").within(() => {
            cy.findByRole("button", { name: "Done" }).click();
        });

        // Check that our device is now cross-signed
        checkDeviceIsCrossSigned();

        // Check that the current device is connected to key backup
        checkDeviceIsConnectedKeyBackup();
    });

    it("Handle incoming verification request with SAS", () => {
        logIntoElement(homeserver.baseUrl, aliceBotClient.getUserId(), aliceBotClient.__cypress_password);

        /* Dismiss "Verify this device" */
        cy.get(".mx_AuthPage").within(() => {
            cy.findByRole("button", { name: "Skip verification for now" }).click();
            cy.findByRole("button", { name: "I'll verify later" }).click();
        });

        /* figure out the device id of the Element client */
        let elementDeviceId: string;
        cy.window({ log: false }).then((win) => {
            const cli = win.mxMatrixClientPeg.safeGet();
            elementDeviceId = cli.getDeviceId();
            expect(elementDeviceId).to.exist;
            cy.log(`Got element device id: ${elementDeviceId}`);
        });

        /* Now initiate a verification request from the *bot* device. */
        let botVerificationRequest: VerificationRequest;
        cy.then(() => {
            async function initVerification() {
                botVerificationRequest = await aliceBotClient
                    .getCrypto()!
                    .requestDeviceVerification(aliceBotClient.getUserId(), elementDeviceId);
            }

            cy.wrap(initVerification(), { log: false });
        }).then(() => {
            cy.log("Initiated verification request");
        });

        /* Check the toast for the incoming request */
        getToast("Verification requested").within(() => {
            // it should contain the device ID of the requesting device
            cy.contains(`${aliceBotClient.getDeviceId()} from `);

            // Accept
            cy.findByRole("button", { name: "Verify Session" }).click();
        });

        /* Click 'Start' to start SAS verification */
        cy.findByRole("button", { name: "Start" }).click();

        /* on the bot side, wait for the verifier to exist ... */
        cy.then(() => cy.wrap(awaitVerifier(botVerificationRequest))).then((verifier: Verifier) => {
            // ... confirm ...
            botVerificationRequest.verifier.verify();

            // ... and then check the emoji match
            doTwoWaySasVerification(verifier);
        });

        /* And we're all done! */
        cy.get(".mx_InfoDialog").within(() => {
            cy.findByRole("button", { name: "They match" }).click();
            cy.findByText(`You've successfully verified (${aliceBotClient.getDeviceId()})!`).should("exist");
            cy.findByRole("button", { name: "Got it" }).click();
        });
    });
});

describe("User verification", () => {
    // note that there are other tests that check user verification works in `crypto.spec.ts`.

    let aliceCredentials: UserCredentials;
    let homeserver: HomeserverInstance;
    let bob: CypressBot;

    beforeEach(() => {
        cy.startHomeserver("default")
            .as("homeserver")
            .then((data) => {
                homeserver = data;
                cy.initTestUser(homeserver, "Alice", undefined, "alice_").then((credentials) => {
                    aliceCredentials = credentials;
                });
                return cy.getBot(homeserver, {
                    displayName: "Bob",
                    autoAcceptInvites: true,
                    userIdPrefix: "bob_",
                });
            })
            .then((data) => {
                bob = data;
            });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("can receive a verification request when there is no existing DM", () => {
        cy.bootstrapCrossSigning(aliceCredentials);

        // the other user creates a DM
        let dmRoomId: string;
        let bobVerificationRequest: VerificationRequest;
        cy.wrap(0).then(async () => {
            dmRoomId = await createDMRoom(bob, aliceCredentials.userId);
        });

        // accept the DM
        cy.viewRoomByName("Bob");
        cy.findByRole("button", { name: "Start chatting" }).click();

        // once Alice has joined, Bob starts the verification
        cy.wrap(0).then(async () => {
            const room = bob.getRoom(dmRoomId)!;
            while (room.getMember(aliceCredentials.userId)?.membership !== "join") {
                await new Promise((resolve) => {
                    // @ts-ignore can't access the enum here
                    room.once("RoomState.members", resolve);
                });
            }
            bobVerificationRequest = await bob.getCrypto()!.requestVerificationDM(aliceCredentials.userId, dmRoomId);
        });

        // there should also be a toast
        getToast("Verification requested").within(() => {
            // it should contain the details of the requesting user
            cy.contains(`Bob (${bob.credentials.userId})`);

            // Accept
            cy.findByRole("button", { name: "Verify Session" }).click();
        });

        // request verification by emoji
        cy.get("#mx_RightPanel").findByRole("button", { name: "Verify by emoji" }).click();

        cy.wrap(0)
            .then(async () => {
                /* on the bot side, wait for the verifier to exist ... */
                const verifier = await awaitVerifier(bobVerificationRequest);
                // ... confirm ...
                verifier.verify();
                return verifier;
            })
            .then((botVerifier) => {
                // ... and then check the emoji match
                doTwoWaySasVerification(botVerifier);
            });

        cy.findByRole("button", { name: "They match" }).click();
        cy.findByText("You've successfully verified Bob!").should("exist");
        cy.findByRole("button", { name: "Got it" }).click();
    });
});

/** Extract the qrcode out of an on-screen html element */
async function readQrCode(qrCode: JQuery<HTMLElement>) {
    // because I don't know how to scrape the imagedata from the cypress browser window,
    // we extract the data url and render it to a new canvas.
    const imageData = await renderQRCode(qrCode.attr("src"));

    // now we can decode the QR code.
    const result = jsQR(imageData.data, imageData.width, imageData.height);
    return new Uint8Array(result.binaryData);
}

async function createDMRoom(client: MatrixClient, userId: string): Promise<string> {
    const r = await client.createRoom({
        // @ts-ignore can't access the enum here
        preset: "trusted_private_chat",
        // @ts-ignore can't access the enum here
        visibility: "private",
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

    const roomId = r.room_id;

    // wait for the room to come down /sync
    while (!client.getRoom(roomId)) {
        await new Promise((resolve) => {
            //@ts-ignore can't access the enum here
            client.once("Room", resolve);
        });
    }

    return roomId;
}

/**
 * Wait for a verifier to exist for a VerificationRequest
 *
 * @param botVerificationRequest
 */
async function awaitVerifier(botVerificationRequest: VerificationRequest): Promise<Verifier> {
    while (!botVerificationRequest.verifier) {
        await emitPromise(botVerificationRequest, "change");
    }
    return botVerificationRequest.verifier;
}
