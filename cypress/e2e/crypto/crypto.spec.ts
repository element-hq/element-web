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
import type { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import type { CypressBot } from "../../support/bot";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { UserCredentials } from "../../support/login";
import {
    checkDeviceIsCrossSigned,
    EmojiMapping,
    handleVerificationRequest,
    logIntoElement,
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

/**
 * Given a VerificationRequest in a bot client, add cypress commands to:
 *   - wait for the bot to receive a 'verify by emoji' notification
 *   - check that the bot sees the same emoji as the application
 *
 * @param botVerificationRequest - a verification request in a bot client
 */
function doTwoWaySasVerification(botVerificationRequest: VerificationRequest): void {
    // on the bot side, wait for the emojis, confirm they match, and return them
    const emojiPromise = handleVerificationRequest(botVerificationRequest);

    // then, check that our application shows an emoji panel with the same emojis.
    cy.wrap(emojiPromise).then((emojis: EmojiMapping[]) => {
        cy.get(".mx_VerificationShowSas_emojiSas_block").then((emojiBlocks) => {
            emojis.forEach((emoji: EmojiMapping, index: number) => {
                expect(emojiBlocks[index].textContent.toLowerCase()).to.eq(emoji[0] + emoji[1]);
            });
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
        cy.findByRole("button", { name: "Verify by emoji" }).click();
        cy.wrap(bobsVerificationRequestPromise).then((request: VerificationRequest) => {
            doTwoWaySasVerification(request);
        });
        cy.findByRole("button", { name: "They match" }).click();
        cy.findByText("You've successfully verified Bob!").should("exist");
        cy.findByRole("button", { name: "Got it" }).click();
    });
};

describe("Cryptography", function () {
    let aliceCredentials: UserCredentials;

    beforeEach(function () {
        cy.startHomeserver("default")
            .as("homeserver")
            .then((homeserver: HomeserverInstance) => {
                cy.initTestUser(homeserver, "Alice", undefined, "alice_").then((credentials) => {
                    aliceCredentials = credentials;
                });
                cy.getBot(homeserver, {
                    displayName: "Bob",
                    autoAcceptInvites: false,
                    userIdPrefix: "bob_",
                }).as("bob");
            });
    });

    afterEach(function (this: CryptoTestContext) {
        cy.stopHomeserver(this.homeserver);
    });

    it("setting up secure key backup should work", () => {
        skipIfRustCrypto();
        cy.openUserSettings("Security & Privacy");
        cy.findByRole("button", { name: "Set up Secure Backup" }).click();
        cy.get(".mx_Dialog").within(() => {
            cy.findByRole("button", { name: "Continue" }).click();
            cy.get(".mx_CreateSecretStorageDialog_recoveryKey code").invoke("text").as("securityKey");
            // Clicking download instead of Copy because of https://github.com/cypress-io/cypress/issues/2851
            cy.findByRole("button", { name: "Download" }).click();
            cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();
            cy.get(".mx_InteractiveAuthDialog").within(() => {
                cy.get(".mx_Dialog_title").within(() => {
                    cy.findByText("Setting up keys").should("exist");
                    cy.findByText("Setting up keys").should("not.exist");
                });
            });

            cy.findByText("Secure Backup successful").should("exist");
            cy.findByRole("button", { name: "Done" }).click();
            cy.findByText("Secure Backup successful").should("not.exist");
        });
        return;
    });

    it("creating a DM should work, being e2e-encrypted / user verification", function (this: CryptoTestContext) {
        skipIfRustCrypto();
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
        skipIfRustCrypto();
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

    it("should show the correct shield on edited e2e events", function (this: CryptoTestContext) {
        skipIfRustCrypto();
        cy.bootstrapCrossSigning(aliceCredentials);

        // bob has a second, not cross-signed, device
        cy.loginBot(this.homeserver, this.bob.getUserId(), this.bob.__cypress_password, {}).as("bobSecondDevice");

        autoJoin(this.bob);

        // first create the room, so that we can open the verification panel
        cy.createRoom({ name: "TestRoom", invite: [this.bob.getUserId()] })
            .as("testRoomId")
            .then((roomId) => {
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
                .should("have.class", "mx_EventTile_verified")
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
                .should("have.class", "mx_EventTile_verified")
                .should("not.have.descendants", ".mx_EventTile_e2eIcon_warning");
        });
    });
});

describe("Verify own device", () => {
    let aliceBotClient: CypressBot;
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        skipIfRustCrypto();
        cy.startHomeserver("default").then((data: HomeserverInstance) => {
            homeserver = data;

            // Visit the login page of the app, to load the matrix sdk
            cy.visit("/#/login");

            // wait for the page to load
            cy.window({ log: false }).should("have.property", "matrixcs");

            // Create a new device for alice
            cy.getBot(homeserver, { bootstrapCrossSigning: true }).then((bot) => {
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

    it("with SAS", function (this: CryptoTestContext) {
        logIntoElement(homeserver.baseUrl, aliceBotClient.getUserId(), aliceBotClient.__cypress_password);

        // Launch the verification request between alice and the bot
        initiateAliceVerificationRequest();

        // Handle emoji SAS verification
        cy.get(".mx_InfoDialog").within(() => {
            cy.get<VerificationRequest>("@verificationRequest").then((request: VerificationRequest) => {
                // Handle emoji request and check that emojis are matching
                doTwoWaySasVerification(request);
            });

            cy.findByRole("button", { name: "They match" }).click();
            cy.findByRole("button", { name: "Got it" }).click();
        });

        // Check that our device is now cross-signed
        checkDeviceIsCrossSigned();
    });
});
