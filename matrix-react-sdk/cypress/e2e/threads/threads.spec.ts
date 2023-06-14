/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { MatrixClient } from "../../global";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
import Chainable = Cypress.Chainable;

describe("Threads", () => {
    let homeserver: HomeserverInstance;

    beforeEach(() => {
        cy.window().then((win) => {
            win.localStorage.setItem("mx_lhs_size", "0"); // Collapse left panel for these tests
        });
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, "Tom");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    it("should be usable for a conversation", () => {
        let bot: MatrixClient;
        cy.getBot(homeserver, {
            displayName: "BotBob",
            autoAcceptInvites: false,
        }).then((_bot) => {
            bot = _bot;
        });

        let roomId: string;
        cy.createRoom({})
            .then((_roomId) => {
                roomId = _roomId;
                return cy.inviteUser(roomId, bot.getUserId());
            })
            .then(async () => {
                await bot.joinRoom(roomId);
                cy.visit("/#/room/" + roomId);
            });

        // Around 200 characters
        const MessageLong =
            "Hello there. Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt " +
            "ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi";

        // --MessageTimestamp-color = #acacac = rgb(172, 172, 172)
        // See: _MessageTimestamp.pcss
        const MessageTimestampColor = "rgb(172, 172, 172)";
        const ThreadViewGroupSpacingStart = "56px"; // --ThreadView_group_spacing-start
        // Exclude timestamp and read marker from snapshots
        const percyCSS = ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";

        cy.get(".mx_RoomView_body").within(() => {
            // User sends message
            cy.findByRole("textbox", { name: "Send a message…" }).type("Hello Mr. Bot{enter}");

            // Check the colour of timestamp on the main timeline
            cy.get(".mx_EventTile_last .mx_EventTile_line .mx_MessageTimestamp").should(
                "have.css",
                "color",
                MessageTimestampColor,
            );

            // Wait for message to send, get its ID and save as @threadId
            cy.contains(".mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
                .invoke("attr", "data-scroll-tokens")
                .as("threadId");
        });

        // Bot starts thread
        cy.get<string>("@threadId").then((threadId) => {
            bot.sendMessage(roomId, threadId, {
                // Send a message long enough to be wrapped to check if avatars inside the ReadReceiptGroup are visible
                body: MessageLong,
                msgtype: "m.text",
            });
        });

        // User asserts timeline thread summary visible & clicks it
        cy.get(".mx_RoomView_body .mx_ThreadSummary")
            .within(() => {
                cy.get(".mx_ThreadSummary_sender").findByText("BotBob").should("exist");
                cy.get(".mx_ThreadSummary_content").findByText(MessageLong).should("exist");
            })
            .click();

        // Wait until the both messages are read
        cy.get(".mx_ThreadView .mx_EventTile_last[data-layout=group]").within(() => {
            cy.get(".mx_EventTile_line .mx_MTextBody").findByText(MessageLong).should("exist");
            cy.get(".mx_ReadReceiptGroup .mx_BaseAvatar_image").should("be.visible");

            // Make sure the CSS style for spacing is applied to mx_EventTile_line on group/modern layout
            cy.get(".mx_EventTile_line").should("have.css", "padding-inline-start", ThreadViewGroupSpacingStart);
        });

        // Take Percy snapshots in group layout and bubble layout (IRC layout is not available on ThreadView)
        cy.get(".mx_ThreadView").percySnapshotElement("Initial ThreadView on group layout", { percyCSS });
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
        cy.get(".mx_ThreadView .mx_EventTile[data-layout='bubble']").should("be.visible");
        cy.get(".mx_ThreadView").percySnapshotElement("Initial ThreadView on bubble layout", { percyCSS });

        // Set the group layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);

        cy.get(".mx_ThreadView .mx_EventTile[data-layout='group'].mx_EventTile_last").within(() => {
            // Wait until the messages are rendered
            cy.get(".mx_EventTile_line .mx_MTextBody").findByText(MessageLong).should("exist");

            // Make sure the avatar inside ReadReceiptGroup is visible on the group layout
            cy.get(".mx_ReadReceiptGroup .mx_BaseAvatar_image").should("be.visible");
        });

        // Enable the bubble layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);

        cy.get(".mx_ThreadView .mx_EventTile[data-layout='bubble'].mx_EventTile_last").within(() => {
            // TODO: remove this after fixing the issue of ReadReceiptGroup being hidden on the bubble layout
            // See: https://github.com/vector-im/element-web/issues/23569
            cy.get(".mx_ReadReceiptGroup .mx_BaseAvatar_image").should("exist");

            // Make sure the avatar inside ReadReceiptGroup is visible on bubble layout
            // TODO: enable this after fixing the issue of ReadReceiptGroup being hidden on the bubble layout
            // See: https://github.com/vector-im/element-web/issues/23569
            // cy.get(".mx_ReadReceiptGroup .mx_BaseAvatar_image").should("be.visible");
        });

        // Re-enable the group layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);

        cy.get(".mx_ThreadView").within(() => {
            // User responds in thread
            cy.findByRole("textbox", { name: "Send a message…" }).type("Test{enter}");

            // Check the colour of timestamp on EventTile in a thread (mx_ThreadView)
            cy.get(".mx_EventTile_last[data-layout='group'] .mx_EventTile_line .mx_MessageTimestamp").should(
                "have.css",
                "color",
                MessageTimestampColor,
            );
        });

        // User asserts summary was updated correctly
        cy.get(".mx_RoomView_body .mx_ThreadSummary").within(() => {
            cy.get(".mx_ThreadSummary_sender").findByText("Tom").should("exist");
            cy.get(".mx_ThreadSummary_content").findByText("Test").should("exist");
        });

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Check reactions and hidden events
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        // Enable hidden events to make the event for reaction displayed
        cy.setSettingValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);

        // User reacts to message instead
        cy.get(".mx_ThreadView").within(() => {
            cy.contains(".mx_EventTile .mx_EventTile_line", "Hello there")
                .realHover()
                .findByRole("toolbar", { name: "Message Actions" })
                .findByRole("button", { name: "React" })
                .click();
        });

        cy.get(".mx_EmojiPicker").within(() => {
            cy.findByRole("textbox").type("wave");
            cy.findByRole("gridcell", { name: "👋" }).click();
        });

        cy.get(".mx_ThreadView").within(() => {
            // Make sure the CSS style for spacing is applied to mx_ReactionsRow on group/modern layout
            cy.get(".mx_EventTile[data-layout=group] .mx_ReactionsRow").should(
                "have.css",
                "margin-inline-start",
                ThreadViewGroupSpacingStart,
            );

            // Make sure the CSS style for spacing is applied to the hidden event on group/modern layout
            cy.get(
                ".mx_GenericEventListSummary[data-layout=group] .mx_EventTile_info.mx_EventTile_last " +
                    ".mx_EventTile_line",
            ).should("have.css", "padding-inline-start", ThreadViewGroupSpacingStart);
        });

        // Take Percy snapshot of group layout (IRC layout is not available on ThreadView)
        cy.get(".mx_ThreadView").percySnapshotElement("ThreadView with reaction and a hidden event on group layout", {
            percyCSS,
        });

        // Enable bubble layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);

        // Make sure the CSS style for spacing is applied to the hidden event on bubble layout
        cy.get(
            ".mx_ThreadView .mx_GenericEventListSummary[data-layout=bubble] .mx_EventTile_info.mx_EventTile_last",
        ).within(() => {
            cy.get(".mx_EventTile_line .mx_EventTile_content")
                // 76px: ThreadViewGroupSpacingStart + 14px + 6px
                // 14px: avatar width
                // See: _EventTile.pcss
                .should("have.css", "margin-inline-start", "76px");
            cy.get(".mx_EventTile_line")
                // Make sure the margin is NOT applied to mx_EventTile_line
                .should("have.css", "margin-inline-start", "0px");
        });

        // Take Percy snapshot of bubble layout
        cy.get(".mx_ThreadView").percySnapshotElement("ThreadView with reaction and a hidden event on bubble layout", {
            percyCSS,
        });

        // Disable hidden events
        cy.setSettingValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, false);

        // Reset to the group layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Check redactions
        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        // User redacts their prior response
        cy.contains(".mx_ThreadView .mx_EventTile .mx_EventTile_line", "Test")
            .realHover()
            .findByRole("button", { name: "Options" })
            .click();
        cy.get(".mx_IconizedContextMenu").within(() => {
            cy.findByRole("menuitem", { name: "Remove" }).click();
        });
        cy.get(".mx_TextInputDialog").within(() => {
            cy.findByRole("button", { name: "Remove" }).should("have.class", "mx_Dialog_primary").click();
        });

        cy.get(".mx_ThreadView").within(() => {
            // Wait until the response is redacted
            cy.get(".mx_EventTile_last .mx_EventTile_receiptSent").should("be.visible");
        });

        // Take Percy snapshots in group layout and bubble layout (IRC layout is not available on ThreadView)
        cy.get(".mx_ThreadView .mx_EventTile[data-layout='group']").should("be.visible");
        cy.get(".mx_ThreadView").percySnapshotElement("ThreadView with redacted messages on group layout", {
            percyCSS,
        });
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
        cy.get(".mx_ThreadView .mx_EventTile[data-layout='bubble']").should("be.visible");
        cy.get(".mx_ThreadView").percySnapshotElement("ThreadView with redacted messages on bubble layout", {
            percyCSS,
        });

        // Set the group layout
        cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);

        // User asserts summary was updated correctly
        cy.get(".mx_RoomView_body .mx_ThreadSummary").within(() => {
            cy.get(".mx_ThreadSummary_sender").findByText("BotBob").should("exist");
            cy.get(".mx_ThreadSummary_content").findByText(MessageLong).should("exist");
        });

        // User closes right panel after clicking back to thread list
        cy.get(".mx_ThreadPanel").within(() => {
            cy.findByRole("button", { name: "Threads" }).click();
            cy.findByRole("button", { name: "Close" }).click();
        });

        // Bot responds to thread
        cy.get<string>("@threadId").then((threadId) => {
            bot.sendMessage(roomId, threadId, {
                body: "How are things?",
                msgtype: "m.text",
            });
        });

        cy.get(".mx_RoomView_body .mx_ThreadSummary").within(() => {
            cy.get(".mx_ThreadSummary_sender").findByText("BotBob").should("exist");
            cy.get(".mx_ThreadSummary_content").findByText("How are things?").should("exist");
        });

        cy.findByRole("button", { name: "Threads" })
            .should("have.class", "mx_RoomHeader_button--unread") // User asserts thread list unread indicator
            .click(); // User opens thread list

        // User asserts thread with correct root & latest events & unread dot
        cy.get(".mx_ThreadPanel .mx_EventTile_last").within(() => {
            cy.get(".mx_EventTile_body").findByText("Hello Mr. Bot").should("exist");
            cy.get(".mx_ThreadSummary_content").findByText("How are things?").should("exist");

            // Check the number of the replies
            cy.get(".mx_ThreadPanel_replies_amount").findByText("2").should("exist");

            // Check the colour of timestamp on thread list
            cy.get(".mx_EventTile_details .mx_MessageTimestamp").should("have.css", "color", MessageTimestampColor);

            // Make sure the notification dot is visible
            cy.get(".mx_NotificationBadge_visible").should("be.visible");

            // User opens thread via threads list
            cy.get(".mx_EventTile_line").click();
        });

        // User responds & asserts
        cy.get(".mx_ThreadView").within(() => {
            cy.findByRole("textbox", { name: "Send a message…" }).type("Great!{enter}");
        });
        cy.get(".mx_RoomView_body .mx_ThreadSummary").within(() => {
            cy.get(".mx_ThreadSummary_sender").findByText("Tom").should("exist");
            cy.get(".mx_ThreadSummary_content").findByText("Great!").should("exist");
        });

        // User edits & asserts
        cy.get(".mx_ThreadView .mx_EventTile_last").within(() => {
            cy.findByText("Great!").should("exist");
            cy.get(".mx_EventTile_line").realHover().findByRole("button", { name: "Edit" }).click();
            cy.findByRole("textbox").type(" How about yourself?{enter}");
        });
        cy.get(".mx_RoomView_body .mx_ThreadSummary").within(() => {
            cy.get(".mx_ThreadSummary_sender").findByText("Tom").should("exist");
            cy.get(".mx_ThreadSummary_content").findByText("Great! How about yourself?").should("exist");
        });

        // User closes right panel
        cy.get(".mx_ThreadPanel").within(() => {
            cy.findByRole("button", { name: "Close" }).click();
        });

        // Bot responds to thread and saves the id of their message to @eventId
        cy.get<string>("@threadId").then((threadId) => {
            cy.wrap(
                bot
                    .sendMessage(roomId, threadId, {
                        body: "I'm very good thanks",
                        msgtype: "m.text",
                    })
                    .then((res) => res.event_id),
            ).as("eventId");
        });

        // User asserts
        cy.get(".mx_RoomView_body .mx_ThreadSummary").within(() => {
            cy.get(".mx_ThreadSummary_sender").findByText("BotBob").should("exist");
            cy.get(".mx_ThreadSummary_content").findByText("I'm very good thanks").should("exist");
        });

        // Bot edits their latest event
        cy.get<string>("@eventId").then((eventId) => {
            bot.sendMessage(roomId, {
                "body": "* I'm very good thanks :)",
                "msgtype": "m.text",
                "m.new_content": {
                    body: "I'm very good thanks :)",
                    msgtype: "m.text",
                },
                "m.relates_to": {
                    rel_type: "m.replace",
                    event_id: eventId,
                },
            });
        });

        // User asserts
        cy.get(".mx_RoomView_body .mx_ThreadSummary").within(() => {
            cy.get(".mx_ThreadSummary_sender").findByText("BotBob").should("exist");
            cy.get(".mx_ThreadSummary_content").findByText("I'm very good thanks :)").should("exist");
        });
    });

    it("can send voice messages", () => {
        // Increase viewport size and right-panel size, so that voice messages fit
        cy.viewport(1280, 720);
        cy.window().then((window) => {
            window.localStorage.setItem("mx_rhs_size", "600");
        });

        let roomId: string;
        cy.createRoom({}).then((_roomId) => {
            roomId = _roomId;
            cy.visit("/#/room/" + roomId);
        });

        // Send message
        cy.get(".mx_RoomView_body").within(() => {
            cy.findByRole("textbox", { name: "Send a message…" }).type("Hello Mr. Bot{enter}");

            // Create thread
            cy.contains(".mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
                .realHover()
                .findByRole("button", { name: "Reply in thread" })
                .click();
        });
        cy.get(".mx_ThreadView_timelinePanelWrapper").should("have.length", 1);

        cy.openMessageComposerOptions(true).findByRole("menuitem", { name: "Voice Message" }).click();
        cy.wait(3000);
        cy.getComposer(true).findByRole("button", { name: "Send voice message" }).click();

        cy.get(".mx_ThreadView .mx_MVoiceMessageBody").should("have.length", 1);
    });

    it("should send location and reply to the location on ThreadView", () => {
        // See: location.spec.ts
        const selectLocationShareTypeOption = (shareType: string): Chainable<JQuery> => {
            return cy.findByTestId(`share-location-option-${shareType}`);
        };
        const submitShareLocation = (): void => {
            cy.findByRole("button", { name: "Share location" }).click();
        };

        let bot: MatrixClient;
        cy.getBot(homeserver, {
            displayName: "BotBob",
            autoAcceptInvites: false,
        }).then((_bot) => {
            bot = _bot;
        });

        let roomId: string;
        cy.createRoom({})
            .then((_roomId) => {
                roomId = _roomId;
                return cy.inviteUser(roomId, bot.getUserId());
            })
            .then(async () => {
                await bot.joinRoom(roomId);
                cy.visit("/#/room/" + roomId);
            });

        // Exclude timestamp, read marker, and mapboxgl-map from snapshots
        const percyCSS =
            ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker, .mapboxgl-map { visibility: hidden !important; }";

        cy.get(".mx_RoomView_body").within(() => {
            // User sends message
            cy.findByRole("textbox", { name: "Send a message…" }).type("Hello Mr. Bot{enter}");

            // Wait for message to send, get its ID and save as @threadId
            cy.contains(".mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
                .invoke("attr", "data-scroll-tokens")
                .as("threadId");
        });

        // Bot starts thread
        cy.get<string>("@threadId").then((threadId) => {
            bot.sendMessage(roomId, threadId, {
                body: "Hello there",
                msgtype: "m.text",
            });
        });

        // User clicks thread summary
        cy.get(".mx_RoomView_body .mx_ThreadSummary").click();

        // User sends location on ThreadView
        cy.get(".mx_ThreadView").should("exist");
        cy.openMessageComposerOptions(true).findByRole("menuitem", { name: "Location" }).click();
        selectLocationShareTypeOption("Pin").click();
        cy.get("#mx_LocationPicker_map").click("center");
        submitShareLocation();
        cy.get(".mx_ThreadView .mx_EventTile_last .mx_MLocationBody", { timeout: 10000 }).should("exist");

        // User replies to the location
        cy.get(".mx_ThreadView").within(() => {
            cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Reply" }).click();

            cy.findByRole("textbox", { name: "Reply to thread…" }).type("Please come here.{enter}");

            // Wait until the reply is sent
            cy.get(".mx_EventTile_last .mx_EventTile_receiptSent").should("be.visible");
        });

        // Take a snapshot of reply to the shared location
        cy.get(".mx_ThreadView").percySnapshotElement("Reply to the location on ThreadView", { percyCSS });
    });

    it("right panel behaves correctly", () => {
        // Create room
        let roomId: string;
        cy.createRoom({}).then((_roomId) => {
            roomId = _roomId;
            cy.visit("/#/room/" + roomId);
        });

        // Send message
        cy.get(".mx_RoomView_body").within(() => {
            cy.findByRole("textbox", { name: "Send a message…" }).type("Hello Mr. Bot{enter}");

            // Create thread
            cy.contains(".mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
                .realHover()
                .findByRole("button", { name: "Reply in thread" })
                .click();
        });
        cy.get(".mx_ThreadView_timelinePanelWrapper").should("have.length", 1);

        // Send message to thread
        cy.get(".mx_ThreadPanel").within(() => {
            cy.findByRole("textbox", { name: "Send a message…" }).type("Hello Mr. User{enter}");
            cy.get(".mx_EventTile_last").findByText("Hello Mr. User").should("exist");

            // Close thread
            cy.findByRole("button", { name: "Close" }).click();
        });

        // Open existing thread
        cy.contains(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", "Hello Mr. Bot")
            .realHover()
            .findByRole("button", { name: "Reply in thread" })
            .click();
        cy.get(".mx_ThreadView_timelinePanelWrapper").should("have.length", 1);

        cy.get(".mx_BaseCard").within(() => {
            cy.get(".mx_EventTile").first().findByText("Hello Mr. Bot").should("exist");
            cy.get(".mx_EventTile").last().findByText("Hello Mr. User").should("exist");
        });
    });
});
