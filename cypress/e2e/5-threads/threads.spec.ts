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
import { MatrixClient } from "../../global";

function markWindowBeforeReload(): void {
    // mark our window object to "know" when it gets reloaded
    cy.window().then(w => w.beforeReload = true);
}

describe("Threads", () => {
    let synapse: SynapseInstance;

    beforeEach(() => {
        // Default threads to ON for this spec
        cy.enableLabsFeature("feature_thread");
        cy.window().then(win => {
            win.localStorage.setItem("mx_lhs_size", "0"); // Collapse left panel for these tests
        });
        cy.startSynapse("default").then(data => {
            synapse = data;

            cy.initTestUser(synapse, "Tom");
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
    });

    it("should reload when enabling threads beta", () => {
        markWindowBeforeReload();

        // Turn off
        cy.openUserSettings("Labs").within(() => {
            // initially the new property is there
            cy.window().should("have.prop", "beforeReload", true);

            cy.leaveBeta("Threads");
            // after reload the property should be gone
            cy.window().should("not.have.prop", "beforeReload");
        });

        cy.get(".mx_MatrixChat", { timeout: 15000 }); // wait for the app
        markWindowBeforeReload();

        // Turn on
        cy.openUserSettings("Labs").within(() => {
            // initially the new property is there
            cy.window().should("have.prop", "beforeReload", true);

            cy.joinBeta("Threads");
            // after reload the property should be gone
            cy.window().should("not.have.prop", "beforeReload");
        });
    });

    it("should be usable for a conversation", () => {
        let bot: MatrixClient;
        cy.getBot(synapse, { displayName: "BotBob" }).then(_bot => {
            bot = _bot;
        });

        let roomId: string;
        cy.createRoom({}).then(_roomId => {
            roomId = _roomId;
            cy.inviteUser(roomId, bot.getUserId());
            cy.visit("/#/room/" + roomId);
        });

        // User sends message
        cy.get(".mx_RoomView_body .mx_BasicMessageComposer_input").type("Hello Mr. Bot{enter}");

        // Wait for message to send, get its ID and save as @threadId
        cy.get(".mx_RoomView_body .mx_EventTile").contains(".mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
            .invoke("attr", "data-scroll-tokens").as("threadId");

        // Bot starts thread
        cy.get<string>("@threadId").then(threadId => {
            bot.sendMessage(roomId, threadId, {
                body: "Hello there",
                msgtype: "m.text",
            });
        });

        // User asserts timeline thread summary visible & clicks it
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_sender").should("contain", "BotBob");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_content").should("contain", "Hello there");
        cy.get(".mx_RoomView_body .mx_ThreadSummary").click();

        // User responds in thread
        cy.get(".mx_ThreadView .mx_BasicMessageComposer_input").type("Test{enter}");

        // User asserts summary was updated correctly
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_sender").should("contain", "Tom");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_content").should("contain", "Test");

        // User reacts to message instead
        cy.get(".mx_ThreadView .mx_EventTile").contains(".mx_EventTile_line", "Hello there")
            .find('[aria-label="React"]').click({ force: true }); // Cypress has no ability to hover
        cy.get(".mx_EmojiPicker").within(() => {
            cy.get('input[type="text"]').type("wave");
            cy.get('[role="menuitem"]').contains("👋").click();
        });

        // User redacts their prior response
        cy.get(".mx_ThreadView .mx_EventTile").contains(".mx_EventTile_line", "Test")
            .find('[aria-label="Options"]').click({ force: true }); // Cypress has no ability to hover
        cy.get(".mx_IconizedContextMenu").within(() => {
            cy.get('[role="menuitem"]').contains("Remove").click();
        });
        cy.get(".mx_TextInputDialog").within(() => {
            cy.get(".mx_Dialog_primary").contains("Remove").click();
        });

        // User asserts summary was updated correctly
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_sender").should("contain", "BotBob");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_content").should("contain", "Hello there");

        // User closes right panel after clicking back to thread list
        cy.get(".mx_ThreadView .mx_BaseCard_back").click();
        cy.get(".mx_ThreadPanel .mx_BaseCard_close").click();

        // Bot responds to thread
        cy.get<string>("@threadId").then(threadId => {
            bot.sendMessage(roomId, threadId, {
                body: "How are things?",
                msgtype: "m.text",
            });
        });

        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_sender").should("contain", "BotBob");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_content").should("contain", "How are things?");
        // User asserts thread list unread indicator
        cy.get('.mx_HeaderButtons [aria-label="Threads"]').should("have.class", "mx_RightPanel_headerButton_unread");

        // User opens thread list
        cy.get('.mx_HeaderButtons [aria-label="Threads"]').click();

        // User asserts thread with correct root & latest events & unread dot
        cy.get(".mx_ThreadPanel .mx_EventTile_last").within(() => {
            cy.get(".mx_EventTile_body").should("contain", "Hello Mr. Bot");
            cy.get(".mx_ThreadSummary_content").should("contain", "How are things?");
            // User opens thread via threads list
            cy.get(".mx_EventTile_line").click();
        });

        // User responds & asserts
        cy.get(".mx_ThreadView .mx_BasicMessageComposer_input").type("Great!{enter}");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_sender").should("contain", "Tom");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_content").should("contain", "Great!");

        // User edits & asserts
        cy.get(".mx_ThreadView .mx_EventTile_last").contains(".mx_EventTile_line", "Great!").within(() => {
            cy.get('[aria-label="Edit"]').click({ force: true }); // Cypress has no ability to hover
            cy.get(".mx_BasicMessageComposer_input").type(" How about yourself?{enter}");
        });
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_sender").should("contain", "Tom");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_content")
            .should("contain", "Great! How about yourself?");

        // User closes right panel
        cy.get(".mx_ThreadView .mx_BaseCard_close").click();

        // Bot responds to thread and saves the id of their message to @eventId
        cy.get<string>("@threadId").then(threadId => {
            cy.wrap(bot.sendMessage(roomId, threadId, {
                body: "I'm very good thanks",
                msgtype: "m.text",
            }).then(res => res.event_id)).as("eventId");
        });

        // User asserts
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_sender").should("contain", "BotBob");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_content")
            .should("contain", "I'm very good thanks");

        // Bot edits their latest event
        cy.get<string>("@eventId").then(eventId => {
            bot.sendMessage(roomId, {
                "body": "* I'm very good thanks :)",
                "msgtype": "m.text",
                "m.new_content": {
                    "body": "I'm very good thanks :)",
                    "msgtype": "m.text",
                },
                "m.relates_to": {
                    "rel_type": "m.replace",
                    "event_id": eventId,
                },
            });
        });

        // User asserts
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_sender").should("contain", "BotBob");
        cy.get(".mx_RoomView_body .mx_ThreadSummary .mx_ThreadSummary_content")
            .should("contain", "I'm very good thanks :)");
    });

    it("can send voice messages", () => {
        // Increase viewport size and right-panel size, so that voice messages fit
        cy.viewport(1280, 720);
        cy.window().then((window) => {
            window.localStorage.setItem("mx_rhs_size", "600");
        });

        let roomId: string;
        cy.createRoom({}).then(_roomId => {
            roomId = _roomId;
            cy.visit("/#/room/" + roomId);
        });

        // Send message
        cy.get(".mx_RoomView_body .mx_BasicMessageComposer_input").type("Hello Mr. Bot{enter}");

        // Create thread
        cy.get(".mx_RoomView_body .mx_EventTile").contains(".mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
            .realHover().find(".mx_MessageActionBar_threadButton").click();
        cy.get(".mx_ThreadView_timelinePanelWrapper").should("have.length", 1);

        cy.openMessageComposerOptions(true).find(`[aria-label="Voice Message"]`).click();
        cy.wait(3000);
        cy.getComposer(true).find(".mx_MessageComposer_sendMessage").click();

        cy.get(".mx_ThreadView .mx_MVoiceMessageBody").should("have.length", 1);
    });

    it("right panel behaves correctly", () => {
        // Create room
        let roomId: string;
        cy.createRoom({}).then(_roomId => {
            roomId = _roomId;
            cy.visit("/#/room/" + roomId);
        });
        // Send message
        cy.get(".mx_RoomView_body .mx_BasicMessageComposer_input").type("Hello Mr. Bot{enter}");

        // Create thread
        cy.get(".mx_RoomView_body .mx_EventTile").contains(".mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
            .realHover().find(".mx_MessageActionBar_threadButton").click();
        cy.get(".mx_ThreadView_timelinePanelWrapper").should("have.length", 1);

        // Send message to thread
        cy.get(".mx_BaseCard .mx_BasicMessageComposer_input").type("Hello Mr. User{enter}");
        cy.get(".mx_BaseCard .mx_EventTile").should("contain", "Hello Mr. User");

        // Close thread
        cy.get(".mx_BaseCard_close").click();

        // Open existing thread
        cy.get(".mx_RoomView_body .mx_EventTile").contains(".mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
            .realHover().find(".mx_MessageActionBar_threadButton").click();
        cy.get(".mx_ThreadView_timelinePanelWrapper").should("have.length", 1);
        cy.get(".mx_BaseCard .mx_EventTile").should("contain", "Hello Mr. Bot");
        cy.get(".mx_BaseCard .mx_EventTile").should("contain", "Hello Mr. User");
    });
});
