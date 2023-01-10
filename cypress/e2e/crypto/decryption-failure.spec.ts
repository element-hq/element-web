/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import type { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import type { ISasEvent } from "matrix-js-sdk/src/crypto/verification/SAS";
import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { UserCredentials } from "../../support/login";
import Chainable = Cypress.Chainable;

const ROOM_NAME = "Test room";
const TEST_USER = "Alia";
const BOT_USER = "Benjamin";

type EmojiMapping = [emoji: string, name: string];

const waitForVerificationRequest = (cli: MatrixClient): Promise<VerificationRequest> => {
    return new Promise<VerificationRequest>((resolve) => {
        const onVerificationRequestEvent = (request: VerificationRequest) => {
            // @ts-ignore CryptoEvent is not exported to window.matrixcs; using the string value here
            cli.off("crypto.verification.request", onVerificationRequestEvent);
            resolve(request);
        };
        // @ts-ignore
        cli.on("crypto.verification.request", onVerificationRequestEvent);
    });
};

const handleVerificationRequest = (request: VerificationRequest): Chainable<EmojiMapping[]> => {
    return cy.wrap(
        new Promise<EmojiMapping[]>((resolve) => {
            const onShowSas = (event: ISasEvent) => {
                verifier.off("show_sas", onShowSas);
                event.confirm();
                resolve(event.sas.emoji);
            };

            const verifier = request.beginKeyVerification("m.sas.v1");
            verifier.on("show_sas", onShowSas);
            verifier.verify();
        }),
    );
};

describe("Decryption Failure Bar", () => {
    let homeserver: HomeserverInstance | undefined;
    let testUser: UserCredentials | undefined;
    let bot: MatrixClient | undefined;
    let roomId: string;

    beforeEach(function () {
        cy.startHomeserver("default").then((hs: HomeserverInstance) => {
            homeserver = hs;
            cy.initTestUser(homeserver, TEST_USER)
                .then((creds: UserCredentials) => {
                    testUser = creds;
                })
                .then(() => {
                    cy.getBot(homeserver, { displayName: BOT_USER }).then((cli) => {
                        bot = cli;
                    });
                })
                .then(() => {
                    cy.createRoom({ name: ROOM_NAME }).then((id) => {
                        roomId = id;
                    });
                })
                .then(() => {
                    cy.inviteUser(roomId, bot.getUserId());
                    cy.visit("/#/room/" + roomId);
                    cy.contains(".mx_TextualEvent", BOT_USER + " joined the room").should("exist");
                })
                .then(() => {
                    cy.getClient()
                        .then(async (cli) => {
                            await cli.setRoomEncryption(roomId, { algorithm: "m.megolm.v1.aes-sha2" });
                            await bot.setRoomEncryption(roomId, { algorithm: "m.megolm.v1.aes-sha2" });
                        })
                        .then(() => {
                            bot.getRoom(roomId).setBlacklistUnverifiedDevices(true);
                        });
                });
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it(
        "should prompt the user to verify, if this device isn't verified " +
            "and there are other verified devices or backups",
        () => {
            let otherDevice: MatrixClient | undefined;
            cy.loginBot(homeserver, testUser.username, testUser.password, {})
                .then(async (cli) => {
                    otherDevice = cli;
                    await otherDevice.bootstrapCrossSigning({
                        authUploadDeviceSigningKeys: async (makeRequest) => {
                            await makeRequest({});
                        },
                        setupNewCrossSigning: true,
                    });
                })
                .then(() => {
                    cy.botSendMessage(bot, roomId, "test");
                    cy.wait(5000);
                    cy.get(".mx_DecryptionFailureBar .mx_DecryptionFailureBar_message_headline").should(
                        "have.text",
                        "Verify this device to access all messages",
                    );

                    cy.percySnapshot("DecryptionFailureBar prompts user to verify");

                    cy.contains(".mx_DecryptionFailureBar_button", "Resend key requests").should("not.exist");
                    cy.contains(".mx_DecryptionFailureBar_button", "Verify").click();

                    const verificationRequestPromise = waitForVerificationRequest(otherDevice);
                    cy.get(".mx_CompleteSecurity_actionRow .mx_AccessibleButton").click();
                    cy.wrap(verificationRequestPromise).then((verificationRequest: VerificationRequest) => {
                        cy.wrap(verificationRequest.accept());
                        handleVerificationRequest(verificationRequest).then((emojis) => {
                            cy.get(".mx_VerificationShowSas_emojiSas_block").then((emojiBlocks) => {
                                emojis.forEach((emoji: EmojiMapping, index: number) => {
                                    expect(emojiBlocks[index].textContent.toLowerCase()).to.eq(emoji[0] + emoji[1]);
                                });
                            });
                        });
                    });
                });
            cy.contains(".mx_AccessibleButton", "They match").click();
            cy.get(".mx_VerificationPanel_verified_section .mx_E2EIcon_verified").should("exist");
            cy.contains(".mx_AccessibleButton", "Got it").click();

            cy.get(".mx_DecryptionFailureBar .mx_DecryptionFailureBar_message_headline").should(
                "have.text",
                "Open another device to load encrypted messages",
            );

            cy.percySnapshot(
                "DecryptionFailureBar prompts user to open another device, with Resend Key Requests button",
            );

            cy.intercept("/_matrix/client/r0/sendToDevice/m.room_key_request/*").as("keyRequest");
            cy.contains(".mx_DecryptionFailureBar_button", "Resend key requests").click();
            cy.wait("@keyRequest");
            cy.contains(".mx_DecryptionFailureBar_button", "Resend key requests").should("not.exist");

            cy.percySnapshot(
                "DecryptionFailureBar prompts user to open another device, " + "without Resend Key Requests button",
            );
        },
    );

    it(
        "should prompt the user to reset keys, if this device isn't verified " +
            "and there are no other verified devices or backups",
        () => {
            cy.loginBot(homeserver, testUser.username, testUser.password, {}).then(async (cli) => {
                await cli.bootstrapCrossSigning({
                    authUploadDeviceSigningKeys: async (makeRequest) => {
                        await makeRequest({});
                    },
                    setupNewCrossSigning: true,
                });
                await cli.logout(true);
            });

            cy.botSendMessage(bot, roomId, "test");
            cy.wait(5000);
            cy.get(".mx_DecryptionFailureBar .mx_DecryptionFailureBar_message_headline").should(
                "have.text",
                "Reset your keys to prevent future decryption errors",
            );

            cy.percySnapshot("DecryptionFailureBar prompts user to reset keys");

            cy.contains(".mx_DecryptionFailureBar_button", "Reset").click();

            cy.get(".mx_Dialog").within(() => {
                cy.contains(".mx_Dialog_primary", "Continue").click();
                cy.get(".mx_CreateSecretStorageDialog_recoveryKey code").invoke("text").as("securityKey");
                // Clicking download instead of Copy because of https://github.com/cypress-io/cypress/issues/2851
                cy.contains(".mx_AccessibleButton", "Download").click();
                cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();
            });

            cy.get(".mx_DecryptionFailureBar .mx_DecryptionFailureBar_message_headline").should(
                "have.text",
                "Some messages could not be decrypted",
            );

            cy.percySnapshot("DecryptionFailureBar displays general message with no call to action");
        },
    );

    it("should appear and disappear as undecryptable messages enter and leave view", () => {
        cy.getClient().then((cli) => {
            for (let i = 0; i < 25; i++) {
                cy.botSendMessage(cli, roomId, `test ${i}`);
            }
        });
        cy.botSendMessage(bot, roomId, "test");
        cy.get(".mx_DecryptionFailureBar").should("exist");
        cy.get(".mx_DecryptionFailureBar .mx_Spinner").should("exist");

        cy.percySnapshot("DecryptionFailureBar displays loading spinner");

        cy.wait(5000);
        cy.get(".mx_DecryptionFailureBar .mx_Spinner").should("not.exist");
        cy.get(".mx_DecryptionFailureBar .mx_DecryptionFailureBar_icon").should("exist");

        cy.get(".mx_RoomView_messagePanel").scrollTo("top");
        cy.get(".mx_DecryptionFailureBar").should("not.exist");

        cy.botSendMessage(bot, roomId, "another test");
        cy.get(".mx_DecryptionFailureBar").should("not.exist");

        cy.get(".mx_RoomView_messagePanel").scrollTo("bottom");
        cy.get(".mx_DecryptionFailureBar").should("exist");
    });
});
