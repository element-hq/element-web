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

import type { ISendEventResponse, MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import type { VerificationRequest } from "matrix-js-sdk/src/crypto-api";
import type { CypressBot } from "../../support/bot";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { UserCredentials } from "../../support/login";
import {
    doTwoWaySasVerification,
    downloadKey,
    enableKeyBackup,
    logIntoElement,
    logOutOfElement,
    waitForVerificationRequest,
} from "./utils";
import { skipIfRustCrypto } from "../../support/util";

interface CryptoTestContext extends Mocha.Context {
    homeserver: HomeserverInstance;
    bob: CypressBot;
}

const openRoomInfo = () => {
    cy.findByRole("button", { name: "Room info" }).click();
    return cy.get(".mx_RightPanel");
};

const checkDMRoom = () => {
    cy.get(".mx_RoomView_body").within(() => {
        cy.findByText("Alice created this DM.").should("exist");
        cy.findByText("Alice invited Bob", { timeout: 1000 }).should("exist");

        cy.get(".mx_cryptoEvent").within(() => {
            cy.findByText("Encryption enabled").should("exist");
        });
    });
};

const startDMWithBob = function (this: CryptoTestContext) {
    cy.get(".mx_RoomList").within(() => {
        cy.findByRole("button", { name: "Start chat" }).click();
    });
    cy.findByTestId("invite-dialog-input").type(this.bob.getUserId());
    cy.get(".mx_InviteDialog_tile_nameStack_name").within(() => {
        cy.findByText("Bob").click();
    });
    cy.get(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name").within(() => {
        cy.findByText("Bob").should("exist");
    });
    cy.findByRole("button", { name: "Go" }).click();
};

const testMessages = function (this: CryptoTestContext) {
    // check the invite message
    cy.findByText("Hey!")
        .closest(".mx_EventTile")
        .within(() => {
            cy.get(".mx_EventTile_e2eIcon_warning").should("not.exist");
        });

    // Bob sends a response
    cy.get<Room>("@bobsRoom").then((room) => {
        this.bob.sendTextMessage(room.roomId, "Hoo!");
    });
    cy.findByText("Hoo!").closest(".mx_EventTile").should("not.have.descendants", ".mx_EventTile_e2eIcon_warning");
};

const bobJoin = function (this: CryptoTestContext) {
    cy.window({ log: false })
        .then(async (win) => {
            const bobRooms = this.bob.getRooms();
            if (!bobRooms.length) {
                await new Promise<void>((resolve) => {
                    const onMembership = (_event) => {
                        this.bob.off(win.matrixcs.RoomMemberEvent.Membership, onMembership);
                        resolve();
                    };
                    this.bob.on(win.matrixcs.RoomMemberEvent.Membership, onMembership);
                });
            }
        })
        .then(() => {
            cy.botJoinRoomByName(this.bob, "Alice").as("bobsRoom");
        });

    cy.findByText("Bob joined the room").should("exist");
};

/** configure the given MatrixClient to auto-accept any invites */
function autoJoin(client: MatrixClient) {
    cy.window({ log: false }).then(async (win) => {
        client.on(win.matrixcs.RoomMemberEvent.Membership, (event, member) => {
            if (member.membership === "invite" && member.userId === client.getUserId()) {
                client.joinRoom(member.roomId);
            }
        });
    });
}

const verify = function (this: CryptoTestContext) {
    const bobsVerificationRequestPromise = waitForVerificationRequest(this.bob);

    openRoomInfo().within(() => {
        cy.findByRole("button", { name: /People \d/ }).click(); // \d is the number of the room members
        cy.findByText("Bob").click();
        cy.findByRole("button", { name: "Verify" }).click();
        cy.findByRole("button", { name: "Start Verification" }).click();

        // this requires creating a DM, so can take a while. Give it a longer timeout.
        cy.findByRole("button", { name: "Verify by emoji", timeout: 30000 }).click();

        cy.wrap(bobsVerificationRequestPromise).then(async (request: VerificationRequest) => {
            // the bot user races with the Element user to hit the "verify by emoji" button
            const verifier = await request.startVerification("m.sas.v1");
            doTwoWaySasVerification(verifier);
        });
        cy.findByRole("button", { name: "They match" }).click();
        cy.findByText("You've successfully verified Bob!").should("exist");
        cy.findByRole("button", { name: "Got it" }).click();
    });
};

describe("Cryptography", function () {
    let aliceCredentials: UserCredentials;
    let homeserver: HomeserverInstance;
    let bob: CypressBot;

    beforeEach(function () {
        cy.startHomeserver("default")
            .as("homeserver")
            .then((data) => {
                homeserver = data;
                cy.initTestUser(homeserver, "Alice", undefined, "alice_").then((credentials) => {
                    aliceCredentials = credentials;
                });
                return cy.getBot(homeserver, {
                    displayName: "Bob",
                    autoAcceptInvites: false,
                    userIdPrefix: "bob_",
                });
            })
            .as("bob")
            .then((data) => {
                bob = data;
            });
    });

    afterEach(function (this: CryptoTestContext) {
        cy.stopHomeserver(this.homeserver);
    });

    for (const isDeviceVerified of [true, false]) {
        it(`setting up secure key backup should work isDeviceVerified=${isDeviceVerified}`, () => {
            /**
             * Verify that the `m.cross_signing.${keyType}` key is available on the account data on the server
             * @param keyType
             */
            function verifyKey(keyType: string) {
                return cy
                    .getClient()
                    .then((cli) => cy.wrap(cli.getAccountDataFromServer(`m.cross_signing.${keyType}`)))
                    .then((accountData: { encrypted: Record<string, Record<string, string>> }) => {
                        expect(accountData.encrypted).to.exist;
                        const keys = Object.keys(accountData.encrypted);
                        const key = accountData.encrypted[keys[0]];
                        expect(key.ciphertext).to.exist;
                        expect(key.iv).to.exist;
                        expect(key.mac).to.exist;
                    });
            }

            it("by recovery code", () => {
                skipIfRustCrypto();

                // Verified the device
                if (isDeviceVerified) {
                    cy.bootstrapCrossSigning(aliceCredentials);
                }

                cy.openUserSettings("Security & Privacy");
                cy.findByRole("button", { name: "Set up Secure Backup" }).click();
                cy.get(".mx_Dialog").within(() => {
                    // Recovery key is selected by default
                    cy.findByRole("button", { name: "Continue" }).click();
                    cy.get(".mx_CreateSecretStorageDialog_recoveryKey code").invoke("text").as("securityKey");

                    downloadKey();

                    // When the device is verified, the `Setting up keys` step is skipped
                    if (!isDeviceVerified) {
                        cy.get(".mx_InteractiveAuthDialog").within(() => {
                            cy.get(".mx_Dialog_title").within(() => {
                                cy.findByText("Setting up keys").should("exist");
                                cy.findByText("Setting up keys").should("not.exist");
                            });
                        });
                    }

                    cy.findByText("Secure Backup successful").should("exist");
                    cy.findByRole("button", { name: "Done" }).click();
                    cy.findByText("Secure Backup successful").should("not.exist");
                });

                // Verify that the SSSS keys are in the account data stored in the server
                verifyKey("master");
                verifyKey("self_signing");
                verifyKey("user_signing");
            });

            it("by passphrase", () => {
                skipIfRustCrypto();

                // Verified the device
                if (isDeviceVerified) {
                    cy.bootstrapCrossSigning(aliceCredentials);
                }

                cy.openUserSettings("Security & Privacy");
                cy.findByRole("button", { name: "Set up Secure Backup" }).click();
                cy.get(".mx_Dialog").within(() => {
                    // Select passphrase option
                    cy.findByText("Enter a Security Phrase").click();
                    cy.findByRole("button", { name: "Continue" }).click();

                    // Fill passphrase input
                    cy.get("input").type("new passphrase for setting up a secure key backup");
                    cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();
                    // Confirm passphrase
                    cy.get("input").type("new passphrase for setting up a secure key backup");
                    cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();

                    downloadKey();

                    cy.findByText("Secure Backup successful").should("exist");
                    cy.findByRole("button", { name: "Done" }).click();
                    cy.findByText("Secure Backup successful").should("not.exist");
                });

                // Verify that the SSSS keys are in the account data stored in the server
                verifyKey("master");
                verifyKey("self_signing");
                verifyKey("user_signing");
            });
        });
    }

    it("creating a DM should work, being e2e-encrypted / user verification", function (this: CryptoTestContext) {
        skipIfRustCrypto(); // needs working event shields
        cy.bootstrapCrossSigning(aliceCredentials);
        startDMWithBob.call(this);
        // send first message
        cy.findByRole("textbox", { name: "Send a message…" }).type("Hey!{enter}");
        checkDMRoom();
        bobJoin.call(this);
        testMessages.call(this);
        verify.call(this);

        // Assert that verified icon is rendered
        cy.findByRole("button", { name: "Room members" }).click();
        cy.findByRole("button", { name: "Room information" }).click();
        cy.get(".mx_RoomSummaryCard_e2ee_verified").should("exist");

        // Take a snapshot of RoomSummaryCard with a verified E2EE icon
        cy.get(".mx_RightPanel").percySnapshotElement("RoomSummaryCard - with a verified E2EE icon", {
            widths: [264], // Emulate the UI. The value is based on minWidth specified on MainSplit.tsx
        });
    });

    it("should allow verification when there is no existing DM", function (this: CryptoTestContext) {
        cy.bootstrapCrossSigning(aliceCredentials);
        autoJoin(this.bob);

        // we need to have a room with the other user present, so we can open the verification panel
        let roomId: string;
        cy.createRoom({ name: "TestRoom", invite: [this.bob.getUserId()] }).then((_room1Id) => {
            roomId = _room1Id;
            cy.log(`Created test room ${roomId}`);
            cy.visit(`/#/room/${roomId}`);
            // wait for Bob to join the room, otherwise our attempt to open his user details may race
            // with his join.
            cy.findByText("Bob joined the room").should("exist");
        });

        verify.call(this);
    });

    describe("event shields", () => {
        let testRoomId: string;

        beforeEach(() => {
            cy.bootstrapCrossSigning(aliceCredentials);
            autoJoin(bob);

            // create an encrypted room
            cy.createRoom({ name: "TestRoom", invite: [bob.getUserId()] })
                .as("testRoomId")
                .then((roomId) => {
                    testRoomId = roomId;
                    cy.log(`Created test room ${roomId}`);
                    cy.visit(`/#/room/${roomId}`);

                    // enable encryption
                    cy.getClient().then((cli) => {
                        cli.sendStateEvent(roomId, "m.room.encryption", { algorithm: "m.megolm.v1.aes-sha2" });
                    });

                    // wait for Bob to join the room, otherwise our attempt to open his user details may race
                    // with his join.
                    cy.findByText("Bob joined the room").should("exist");
                });
        });

        it("should show the correct shield on e2e events", function (this: CryptoTestContext) {
            skipIfRustCrypto();

            // Bob has a second, not cross-signed, device
            let bobSecondDevice: MatrixClient;
            cy.loginBot(homeserver, bob.getUserId(), bob.__cypress_password, {}).then(async (data) => {
                bobSecondDevice = data;
            });

            /* Should show an error for a decryption failure */
            cy.wrap(0).then(() =>
                bob.sendEvent(testRoomId, "m.room.encrypted", {
                    algorithm: "m.megolm.v1.aes-sha2",
                    ciphertext: "the bird is in the hand",
                }),
            );

            cy.get(".mx_EventTile_last")
                .should("contain", "Unable to decrypt message")
                .find(".mx_EventTile_e2eIcon")
                .should("have.class", "mx_EventTile_e2eIcon_decryption_failure")
                .should("have.attr", "aria-label", "This message could not be decrypted");

            /* Should show a red padlock for an unencrypted message in an e2e room */
            cy.wrap(0)
                .then(() =>
                    bob.http.authedRequest<ISendEventResponse>(
                        // @ts-ignore-next this wants a Method instance, but that is hard to get to here
                        "PUT",
                        `/rooms/${encodeURIComponent(testRoomId)}/send/m.room.message/test_txn_1`,
                        undefined,
                        {
                            msgtype: "m.text",
                            body: "test unencrypted",
                        },
                    ),
                )
                .then((resp) => cy.log(`Bob sent unencrypted event with event id ${resp.event_id}`));

            cy.get(".mx_EventTile_last")
                .should("contain", "test unencrypted")
                .find(".mx_EventTile_e2eIcon")
                .should("have.class", "mx_EventTile_e2eIcon_warning")
                .should("have.attr", "aria-label", "Unencrypted");

            /* Should show no padlock for an unverified user */
            // bob sends a valid event
            cy.wrap(0)
                .then(() => bob.sendTextMessage(testRoomId, "test encrypted 1"))
                .then((resp) => cy.log(`Bob sent message from primary device with event id ${resp.event_id}`));

            // the message should appear, decrypted, with no warning, but also no "verified"
            cy.get(".mx_EventTile_last")
                .should("contain", "test encrypted 1")
                // no e2e icon
                .should("not.have.descendants", ".mx_EventTile_e2eIcon");

            /* Now verify Bob */
            verify.call(this);

            /* Existing message should be updated when user is verified. */
            cy.get(".mx_EventTile_last")
                .should("contain", "test encrypted 1")
                // still no e2e icon
                .should("not.have.descendants", ".mx_EventTile_e2eIcon");

            /* should show no padlock, and be verified, for a message from a verified device */
            cy.wrap(0)
                .then(() => bob.sendTextMessage(testRoomId, "test encrypted 2"))
                .then((resp) => cy.log(`Bob sent second message from primary device with event id ${resp.event_id}`));

            cy.get(".mx_EventTile_last")
                .should("contain", "test encrypted 2")
                // no e2e icon
                .should("not.have.descendants", ".mx_EventTile_e2eIcon");

            /* should show red padlock for a message from an unverified device */
            cy.wrap(0)
                .then(() => bobSecondDevice.sendTextMessage(testRoomId, "test encrypted from unverified"))
                .then((resp) => cy.log(`Bob sent message from unverified device with event id ${resp.event_id}`));

            cy.get(".mx_EventTile_last")
                .should("contain", "test encrypted from unverified")
                .find(".mx_EventTile_e2eIcon", { timeout: 100000 })
                .should("have.class", "mx_EventTile_e2eIcon_warning")
                .should("have.attr", "aria-label", "Encrypted by an unverified user.");

            /* Should show a grey padlock for a message from an unknown device */

            // bob deletes his second device, making the encrypted event from the unverified device "unknown".
            cy.wrap(0)
                .then(() => bobSecondDevice.logout(true))
                .then(() => cy.log(`Bob logged out second device`));

            cy.get(".mx_EventTile_last")
                .should("contain", "test encrypted from unverified")
                .find(".mx_EventTile_e2eIcon")
                .should("have.class", "mx_EventTile_e2eIcon_normal")
                .should("have.attr", "aria-label", "Encrypted by an unknown or deleted device.");
        });

        it("Should show a grey padlock for a key restored from backup", () => {
            skipIfRustCrypto();

            enableKeyBackup();

            // bob sends a valid event
            cy.wrap(0)
                .then(() => bob.sendTextMessage(testRoomId, "test encrypted 1"))
                .then((resp) => cy.log(`Bob sent message from primary device with event id ${resp.event_id}`));

            cy.get(".mx_EventTile_last")
                .should("contain", "test encrypted 1")
                // no e2e icon
                .should("not.have.descendants", ".mx_EventTile_e2eIcon");

            /* log out, and back i */
            logOutOfElement();
            cy.get<string>("@securityKey").then((securityKey) => {
                logIntoElement(homeserver.baseUrl, aliceCredentials.username, aliceCredentials.password, securityKey);
            });

            /* go back to the test room and find Bob's message again */
            cy.viewRoomById(testRoomId);
            cy.get(".mx_EventTile_last")
                .should("contain", "test encrypted 1")
                .find(".mx_EventTile_e2eIcon")
                .should("have.class", "mx_EventTile_e2eIcon_normal")
                .should(
                    "have.attr",
                    "aria-label",
                    "The authenticity of this encrypted message can't be guaranteed on this device.",
                );
        });

        it("should show the correct shield on edited e2e events", function (this: CryptoTestContext) {
            skipIfRustCrypto();

            // bob has a second, not cross-signed, device
            cy.loginBot(this.homeserver, this.bob.getUserId(), this.bob.__cypress_password, {}).as("bobSecondDevice");

            // verify Bob
            verify.call(this);

            cy.get<string>("@testRoomId").then((roomId) => {
                // bob sends a valid event
                cy.wrap(this.bob.sendTextMessage(roomId, "Hoo!")).as("testEvent");

                // the message should appear, decrypted, with no warning
                cy.get(".mx_EventTile_last .mx_EventTile_body")
                    .within(() => {
                        cy.findByText("Hoo!");
                    })
                    .closest(".mx_EventTile")
                    .should("not.have.descendants", ".mx_EventTile_e2eIcon_warning");

                // bob sends an edit to the first message with his unverified device
                cy.get<MatrixClient>("@bobSecondDevice").then((bobSecondDevice) => {
                    cy.get<ISendEventResponse>("@testEvent").then((testEvent) => {
                        bobSecondDevice.sendMessage(roomId, {
                            "m.new_content": {
                                msgtype: "m.text",
                                body: "Haa!",
                            },
                            "m.relates_to": {
                                rel_type: "m.replace",
                                event_id: testEvent.event_id,
                            },
                        });
                    });
                });

                // the edit should have a warning
                cy.contains(".mx_EventTile_body", "Haa!")
                    .closest(".mx_EventTile")
                    .within(() => {
                        cy.get(".mx_EventTile_e2eIcon_warning").should("exist");
                    });

                // a second edit from the verified device should be ok
                cy.get<ISendEventResponse>("@testEvent").then((testEvent) => {
                    this.bob.sendMessage(roomId, {
                        "m.new_content": {
                            msgtype: "m.text",
                            body: "Hee!",
                        },
                        "m.relates_to": {
                            rel_type: "m.replace",
                            event_id: testEvent.event_id,
                        },
                    });
                });

                cy.get(".mx_EventTile_last .mx_EventTile_body")
                    .within(() => {
                        cy.findByText("Hee!");
                    })
                    .closest(".mx_EventTile")
                    .should("not.have.descendants", ".mx_EventTile_e2eIcon_warning");
            });
        });
    });
});
