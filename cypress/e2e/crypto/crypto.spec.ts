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
import type { MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { SynapseInstance } from "../../plugins/synapsedocker";
import Chainable = Cypress.Chainable;

type EmojiMapping = [emoji: string, name: string];
interface CryptoTestContext extends Mocha.Context {
    synapse: SynapseInstance;
    bob: MatrixClient;
}

const waitForVerificationRequest = (cli: MatrixClient): Promise<VerificationRequest> => {
    return new Promise<VerificationRequest>(resolve => {
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

const startDMWithBob = function(this: CryptoTestContext) {
    cy.get('.mx_RoomList [aria-label="Start chat"]').click();
    cy.get('[data-test-id="invite-dialog-input"]').type(this.bob.getUserId());
    cy.contains(".mx_InviteDialog_tile_nameStack_name", "Bob").click();
    cy.contains(".mx_InviteDialog_userTile_pill .mx_InviteDialog_userTile_name", "Bob").should("exist");
    cy.get(".mx_InviteDialog_goButton").click();
};

const testMessages = function(this: CryptoTestContext) {
    // check the invite message
    cy.contains(".mx_EventTile_body", "Hey!")
        .closest(".mx_EventTile")
        .should("not.have.descendants", ".mx_EventTile_e2eIcon_warning")
        .should("have.descendants", ".mx_EventTile_receiptSent");

    // Bob sends a response
    cy.get<Room>("@bobsRoom").then((room) => {
        this.bob.sendTextMessage(room.roomId, "Hoo!");
    });
    cy.contains(".mx_EventTile_body", "Hoo!")
        .closest(".mx_EventTile")
        .should("not.have.descendants", ".mx_EventTile_e2eIcon_warning");
};

const bobJoin = function(this: CryptoTestContext) {
    cy.botJoinRoomByName(this.bob, "Alice").as("bobsRoom");
    cy.contains(".mx_TextualEvent", "Bob joined the room").should("exist");
};

const handleVerificationRequest = (request: VerificationRequest): Chainable<EmojiMapping[]> => {
    return cy.wrap(new Promise<EmojiMapping[]>((resolve) => {
        const onShowSas = (event: ISasEvent) => {
            resolve(event.sas.emoji);
            verifier.off("show_sas", onShowSas);
            event.confirm();
            verifier.done();
        };

        const verifier = request.beginKeyVerification("m.sas.v1");
        verifier.on("show_sas", onShowSas);
        verifier.verify();
    }));
};

const verify = function(this: CryptoTestContext) {
    const bobsVerificationRequestPromise = waitForVerificationRequest(this.bob);

    openRoomInfo().within(() => {
        cy.get(".mx_RoomSummaryCard_icon_people").click();
        cy.contains(".mx_EntityTile_name", "Bob").click();
        cy.contains(".mx_UserInfo_verifyButton", "Verify").click();
        cy.contains(".mx_AccessibleButton", "Start Verification").click();
        cy.wrap(bobsVerificationRequestPromise).then((verificationRequest: VerificationRequest) => {
            verificationRequest.accept();
            return verificationRequest;
        }).as("bobsVerificationRequest");
        cy.contains(".mx_AccessibleButton", "Verify by emoji").click();
        cy.get<VerificationRequest>("@bobsVerificationRequest").then((request: VerificationRequest) => {
            return handleVerificationRequest(request).then((emojis: EmojiMapping[]) => {
                cy.get('.mx_VerificationShowSas_emojiSas_block').then((emojiBlocks) => {
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

describe("Cryptography", function() {
    beforeEach(function() {
        cy.startSynapse("default").as("synapse").then((synapse: SynapseInstance) => {
            cy.initTestUser(synapse, "Alice");
            cy.getBot(synapse, { displayName: "Bob", autoAcceptInvites: false }).as("bob");
        });
    });

    afterEach(function(this: CryptoTestContext) {
        cy.stopSynapse(this.synapse);
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

    it("creating a DM should work, being e2e-encrypted / user verification", function(this: CryptoTestContext) {
        cy.bootstrapCrossSigning();
        startDMWithBob.call(this);
        // send first message
        cy.get(".mx_BasicMessageComposer_input")
            .click()
            .should("have.focus")
            .type("Hey!{enter}");
        checkDMRoom();
        bobJoin.call(this);
        testMessages.call(this);
        verify.call(this);
    });
});
