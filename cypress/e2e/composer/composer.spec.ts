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

/// <reference types="cypress" />

import { SynapseInstance } from "../../plugins/synapsedocker";
import { SettingLevel } from "../../../src/settings/SettingLevel";

describe("Composer", () => {
    let synapse: SynapseInstance;

    beforeEach(() => {
        cy.startSynapse("default").then(data => {
            synapse = data;
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
    });

    describe("CIDER", () => {
        beforeEach(() => {
            cy.initTestUser(synapse, "Janet").then(() => {
                cy.createRoom({ name: "Composing Room" });
            });
            cy.viewRoomByName("Composing Room");
        });

        it("sends a message when you click send or press Enter", () => {
            // Type a message
            cy.get('div[contenteditable=true]').type('my message 0');
            // It has not been sent yet
            cy.contains('.mx_EventTile_body', 'my message 0').should('not.exist');

            // Click send
            cy.get('div[aria-label="Send message"]').click();
            // It has been sent
            cy.contains('.mx_EventTile_body', 'my message 0');

            // Type another and press Enter afterwards
            cy.get('div[contenteditable=true]').type('my message 1{enter}');
            // It was sent
            cy.contains('.mx_EventTile_body', 'my message 1');
        });

        it("can write formatted text", () => {
            cy.get('div[contenteditable=true]').type('my bold{ctrl+b} message');
            cy.get('div[aria-label="Send message"]').click();
            // Note: both "bold" and "message" are bold, which is probably surprising
            cy.contains('.mx_EventTile_body strong', 'bold message');
        });

        it("should allow user to input emoji via graphical picker", () => {
            cy.getComposer(false).within(() => {
                cy.get('[aria-label="Emoji"]').click();
            });

            cy.get('[data-testid="mx_EmojiPicker"]').within(() => {
                cy.contains(".mx_EmojiPicker_item", "😇").click();
            });

            cy.get(".mx_ContextualMenu_background").click(); // Close emoji picker
            cy.get('div[contenteditable=true]').type("{enter}"); // Send message

            cy.contains(".mx_EventTile_body", "😇");
        });

        describe("when Ctrl+Enter is required to send", () => {
            beforeEach(() => {
                cy.setSettingValue("MessageComposerInput.ctrlEnterToSend", null, SettingLevel.ACCOUNT, true);
            });

            it("only sends when you press Ctrl+Enter", () => {
                // Type a message and press Enter
                cy.get('div[contenteditable=true]').type('my message 3{enter}');
                // It has not been sent yet
                cy.contains('.mx_EventTile_body', 'my message 3').should('not.exist');

                // Press Ctrl+Enter
                cy.get('div[contenteditable=true]').type('{ctrl+enter}');
                // It was sent
                cy.contains('.mx_EventTile_body', 'my message 3');
            });
        });
    });

    describe("WYSIWYG", () => {
        beforeEach(() => {
            cy.enableLabsFeature("feature_wysiwyg_composer");
            cy.initTestUser(synapse, "Janet").then(() => {
                cy.createRoom({ name: "Composing Room" });
            });
            cy.viewRoomByName("Composing Room");
        });

        it("sends a message when you click send or press Enter", () => {
            // Type a message
            cy.get('div[contenteditable=true]').type('my message 0');
            // It has not been sent yet
            cy.contains('.mx_EventTile_body', 'my message 0').should('not.exist');

            // Click send
            cy.get('div[aria-label="Send message"]').click();
            // It has been sent
            cy.contains('.mx_EventTile_body', 'my message 0');

            // Type another
            cy.get('div[contenteditable=true]').type('my message 1');
            // Press enter. Would be nice to just use {enter} but we can't because Cypress
            // does not trigger an insertParagraph when you do that.
            cy.get('div[contenteditable=true]').trigger('input', { inputType: "insertParagraph" });
            // It was sent
            cy.contains('.mx_EventTile_body', 'my message 1');
        });

        it("can write formatted text", () => {
            cy.get('div[contenteditable=true]').type('my {ctrl+b}bold{ctrl+b} message');
            cy.get('div[aria-label="Send message"]').click();
            cy.contains('.mx_EventTile_body strong', 'bold');
        });

        describe("when Ctrl+Enter is required to send", () => {
            beforeEach(() => {
                cy.setSettingValue("MessageComposerInput.ctrlEnterToSend", null, SettingLevel.ACCOUNT, true);
            });

            it("only sends when you press Ctrl+Enter", () => {
                // Type a message and press Enter
                cy.get('div[contenteditable=true]').type('my message 3');
                cy.get('div[contenteditable=true]').trigger('input', { inputType: "insertParagraph" });
                // It has not been sent yet
                cy.contains('.mx_EventTile_body', 'my message 3').should('not.exist');

                // Press Ctrl+Enter
                cy.get('div[contenteditable=true]').type('{ctrl+enter}');
                // It was sent
                cy.contains('.mx_EventTile_body', 'my message 3');
            });
        });
    });
});
