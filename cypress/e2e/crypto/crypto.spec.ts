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
import type { ISasEvent } from "matrix-js-sdk/src/crypto/verification/SAS";
import type { CypressBot } from "../../support/bot";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import Chainable = Cypress.Chainable;

type EmojiMapping = [emoji: string, name: string];
interface CryptoTestContext extends Mocha.Context {
    homeserver: HomeserverInstance;
    bob: CypressBot;
}

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

const openRoomInfo = () => {
    cy.get(".mx_RightPanel_roomSummaryButton").click();
    return cy.get(".mx_RightPanel");
};

const checkDMRoom = () => {
    cy.contains(".mx_TextualEvent", "Alice invited Bob").should("exist");
    cy.contains(".mx_RoomView_body .mx_cryptoEvent", "Encryption enabled").should("exist");
};

const startDMWithBob = function (this: CryptoTestContext) {
    cy.get('.mx_RoomList [aria-label="Start chat"]').click();
    cy.get('[data-testid="invite-dialog-input"]').type(this.bob.getUserId());
    cy.contains(".mx_InviteDialog_tile_nameStack_name", "Bob").click();
    cy.contains(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name", "Bob").should("exist");
    cy.get(".mx_InviteDialog_goButton").click();
};

const testMessages = function (this: CryptoTestContext) {
    // check the invite message
    cy.contains(".mx_EventTile_body", "Hey!")
        .closest(".mx_EventTile")
        .within(() => {
            cy.get(".mx_EventTile_e2eIcon_warning").should("not.exist");
        });

    // Bob sends a response
    cy.get<Room>("@bobsRoom").then((room) => {
        this.bob.sendTextMessage(room.roomId, "Hoo!");
    });
    cy.contains(".mx_EventTile_body", "Hoo!")
        .closest(".mx_EventTile")
        .should("not.have.descendants", ".mx_EventTile_e2eIcon_warning");
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

    cy.contains(".mx_TextualEvent", "Bob joined the room").should("exist");
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

const handleVerificationRequest = (request: VerificationRequest): Chainable<EmojiMapping[]> => {
    return cy.wrap(
        new Promise<EmojiMapping[]>((resolve) => {
            const onShowSas = (event: ISasEvent) => {
                verifier.off("show_sas", onShowSas);
                event.confirm();
                verifier.done();
                resolve(event.sas.emoji);
            };

            const verifier = request.beginKeyVerification("m.sas.v1");
            verifier.on("show_sas", onShowSas);
            verifier.verify();
        }),
    );
};

const verify = function (this: CryptoTestContext) {
    const bobsVerificationRequestPromise = waitForVerificationRequest(this.bob);

    openRoomInfo().within(() => {
        cy.get(".mx_RoomSummaryCard_icon_people").click();
        cy.contains(".mx_EntityTile_name", "Bob").click();
        cy.contains(".mx_UserInfo_verifyButton", "Verify").click();
        cy.contains(".mx_AccessibleButton", "Start Verification").click();
        cy.wrap(bobsVerificationRequestPromise)
            .then((verificationRequest: VerificationRequest) => {
                verificationRequest.accept();
                return verificationRequest;
            })
            .as("bobsVerificationRequest");
        cy.contains(".mx_AccessibleButton", "Verify by emoji").click();
        cy.get<VerificationRequest>("@bobsVerificationRequest").then((request: VerificationRequest) => {
            return handleVerificationRequest(request).then((emojis: EmojiMapping[]) => {
                cy.get(".mx_VerificationShowSas_emojiSas_block").then((emojiBlocks) => {
                    emojis.forEach((emoji: EmojiMapping, index: number) => {
                        expect(emojiBlocks[index].textContent.toLowerCase()).to.eq(emoji[0] + emoji[1]);
                    });
                });
            });
        });
        cy.contains(".mx_AccessibleButton", "They match").click();
        cy.contains("You've successfully verified Bob!").should("exist");
        cy.contains(".mx_AccessibleButton", "Got it").click();
    });
};

describe("Cryptography", function () {
    beforeEach(function () {
        cy.startHomeserver("default")
            .as("homeserver")
            .then((homeserver: HomeserverInstance) => {
                cy.initTestUser(homeserver, "Alice", undefined, "alice_");
                cy.getBot(homeserver, { displayName: "Bob", autoAcceptInvites: false, userIdPrefix: "bob_" }).as("bob");
            });
    });

    afterEach(function (this: CryptoTestContext) {
        cy.stopHomeserver(this.homeserver);
    });

    it("setting up secure key backup should work", () => {
        cy.openUserSettings("Security & Privacy");
        cy.contains(".mx_AccessibleButton", "Set up Secure Backup").click();
        cy.get(".mx_Dialog").within(() => {
            cy.contains(".mx_Dialog_primary", "Continue").click();
            cy.get(".mx_CreateSecretStorageDialog_recoveryKey code").invoke("text").as("securityKey");
            // Clicking download instead of Copy because of https://github.com/cypress-io/cypress/issues/2851
            cy.contains(".mx_AccessibleButton", "Download").click();
            cy.contains(".mx_Dialog_primary:not([disabled])", "Continue").click();
            cy.contains(".mx_Dialog_title", "Setting up keys").should("exist");
            cy.contains(".mx_Dialog_title", "Setting up keys").should("not.exist");
        });
        return;
    });

    it("creating a DM should work, being e2e-encrypted / user verification", function (this: CryptoTestContext) {
        cy.bootstrapCrossSigning();
        startDMWithBob.call(this);
        // send first message
        cy.get(".mx_BasicMessageComposer_input").click().should("have.focus").type("Hey!{enter}");
        checkDMRoom();
        bobJoin.call(this);
        testMessages.call(this);
        verify.call(this);
    });

    it("should allow verification when there is no existing DM", function (this: CryptoTestContext) {
        cy.bootstrapCrossSigning();
        autoJoin(this.bob);

        // we need to have a room with the other user present, so we can open the verification panel
        let roomId: string;
        cy.createRoom({ name: "TestRoom", invite: [this.bob.getUserId()] }).then((_room1Id) => {
            roomId = _room1Id;
            cy.log(`Created test room ${roomId}`);
            cy.visit(`/#/room/${roomId}`);
            // wait for Bob to join the room, otherwise our attempt to open his user details may race
            // with his join.
            cy.contains(".mx_TextualEvent", "Bob joined the room").should("exist");
        });

        verify.call(this);
    });

    it("should show the correct shield on edited e2e events", function (this: CryptoTestContext) {
        cy.bootstrapCrossSigning();

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
                cy.contains(".mx_TextualEvent", "Bob joined the room").should("exist");
            });

        verify.call(this);

        cy.get<string>("@testRoomId").then((roomId) => {
            // bob sends a valid event
            cy.wrap(this.bob.sendTextMessage(roomId, "Hoo!")).as("testEvent");

            // the message should appear, decrypted, with no warning
            cy.contains(".mx_EventTile_body", "Hoo!")
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

            cy.contains(".mx_EventTile_body", "Hee!")
                .closest(".mx_EventTile")
                .should("have.class", "mx_EventTile_verified")
                .should("not.have.descendants", ".mx_EventTile_e2eIcon_warning");
        });
    });
});
