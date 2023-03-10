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

import type { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import type { EventType, MsgType } from "matrix-js-sdk/src/@types/event";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
import { MatrixClient } from "../../global";
import Chainable = Cypress.Chainable;

// The avatar size used in the timeline
const AVATAR_SIZE = 30;
// The resize method used in the timeline
const AVATAR_RESIZE_METHOD = "crop";

const ROOM_NAME = "Test room";
const OLD_AVATAR = "avatar_image1";
const NEW_AVATAR = "avatar_image2";
const OLD_NAME = "Alan";
const NEW_NAME = "Alan (away)";

const getEventTilesWithBodies = (): Chainable<JQuery> => {
    return cy.get(".mx_EventTile").filter((_i, e) => e.getElementsByClassName("mx_EventTile_body").length > 0);
};

const expectDisplayName = (e: JQuery<HTMLElement>, displayName: string): void => {
    expect(e.find(".mx_DisambiguatedProfile_displayName").text()).to.equal(displayName);
};

const expectAvatar = (e: JQuery<HTMLElement>, avatarUrl: string): void => {
    cy.all([cy.window({ log: false }), cy.getClient()]).then(([win, cli]) => {
        const size = AVATAR_SIZE * win.devicePixelRatio;
        expect(e.find(".mx_BaseAvatar_image").attr("src")).to.equal(
            // eslint-disable-next-line no-restricted-properties
            cli.mxcUrlToHttp(avatarUrl, size, size, AVATAR_RESIZE_METHOD),
        );
    });
};

const sendEvent = (roomId: string, html = false): Chainable<ISendEventResponse> => {
    const content = {
        msgtype: "m.text" as MsgType,
        body: "Message",
        format: undefined,
        formatted_body: undefined,
    };
    if (html) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = "<b>Message</b>";
    }
    return cy.sendEvent(roomId, null, "m.room.message" as EventType, content);
};

describe("Timeline", () => {
    let homeserver: HomeserverInstance;

    let roomId: string;

    let oldAvatarUrl: string;
    let newAvatarUrl: string;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;
            cy.initTestUser(homeserver, OLD_NAME).then(() =>
                cy.createRoom({ name: ROOM_NAME }).then((_room1Id) => {
                    roomId = _room1Id;
                }),
            );
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
    });

    describe("useOnlyCurrentProfiles", () => {
        beforeEach(() => {
            cy.uploadContent(OLD_AVATAR).then(({ content_uri: url }) => {
                oldAvatarUrl = url;
                cy.setAvatarUrl(url);
            });
            cy.uploadContent(NEW_AVATAR).then(({ content_uri: url }) => {
                newAvatarUrl = url;
            });
        });

        it("should show historical profiles if disabled", () => {
            cy.setSettingValue("useOnlyCurrentProfiles", null, SettingLevel.ACCOUNT, false);
            sendEvent(roomId);
            cy.setDisplayName("Alan (away)");
            cy.setAvatarUrl(newAvatarUrl);
            // XXX: If we send the second event too quickly, there won't be
            // enough time for the client to register the profile change
            cy.wait(500);
            sendEvent(roomId);
            cy.viewRoomByName(ROOM_NAME);

            const events = getEventTilesWithBodies();

            events.should("have.length", 2);
            events.each((e, i) => {
                if (i === 0) {
                    expectDisplayName(e, OLD_NAME);
                    expectAvatar(e, oldAvatarUrl);
                } else if (i === 1) {
                    expectDisplayName(e, NEW_NAME);
                    expectAvatar(e, newAvatarUrl);
                }
            });
        });

        it("should not show historical profiles if enabled", () => {
            cy.setSettingValue("useOnlyCurrentProfiles", null, SettingLevel.ACCOUNT, true);
            sendEvent(roomId);
            cy.setDisplayName(NEW_NAME);
            cy.setAvatarUrl(newAvatarUrl);
            // XXX: If we send the second event too quickly, there won't be
            // enough time for the client to register the profile change
            cy.wait(500);
            sendEvent(roomId);
            cy.viewRoomByName(ROOM_NAME);

            const events = getEventTilesWithBodies();

            events.should("have.length", 2);
            events.each((e) => {
                expectDisplayName(e, NEW_NAME);
                expectAvatar(e, newAvatarUrl);
            });
        });
    });

    describe("message displaying", () => {
        beforeEach(() => {
            cy.injectAxe();
        });

        it("should create and configure a room on IRC layout", () => {
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            cy.contains(
                ".mx_RoomView_body .mx_GenericEventListSummary[data-layout=irc] " +
                    ".mx_GenericEventListSummary_summary",
                "created and configured the room.",
            ).should("exist");

            cy.get(".mx_MainSplit").percySnapshotElement("Configured room on IRC layout");
        });

        it("should add inline start margin to an event line on IRC layout", () => {
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            cy.contains(
                ".mx_RoomView_body .mx_GenericEventListSummary " + ".mx_GenericEventListSummary_summary",
                "created and configured the room.",
            ).should("exist");

            // Click "expand" link button
            cy.get(".mx_GenericEventListSummary_toggle[aria-expanded=false]").click();

            // Check the event line has margin instead of inset property
            // cf. _EventTile.pcss
            //  --EventTile_irc_line_info-margin-inline-start
            //  = calc(var(--name-width) + var(--icon-width) + 1 * var(--right-padding))
            //  = 80 + 14 + 5 = 99px

            cy.get(".mx_EventTile[data-layout=irc].mx_EventTile_info:first-of-type .mx_EventTile_line")
                .should("have.css", "margin-inline-start", "99px")
                .should("have.css", "inset-inline-start", "0px");

            // Exclude timestamp and read marker from snapshot
            const percyCSS = ".mx_MessageTimestamp, .mx_RoomView_myReadMarker { visibility: hidden !important; }";
            cy.get(".mx_MainSplit").percySnapshotElement("Event line with inline start margin on IRC layout", {
                percyCSS,
            });
            cy.checkA11y();
        });

        it("should align generic event list summary with messages and emote on IRC layout", () => {
            // This test aims to check:
            // 1. Alignment of collapsed GELS (generic event list summary) and messages
            // 2. Alignment of expanded GELS and messages
            // 3. Alignment of expanded GELS and placeholder of deleted message
            // 4. Alignment of expanded GELS, placeholder of deleted message, and emote

            // Exclude timestamp from snapshot of mx_MainSplit
            const percyCSS = ".mx_MainSplit .mx_MessageTimestamp { visibility: hidden !important; }";

            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            cy.contains(
                ".mx_RoomView_body .mx_GenericEventListSummary .mx_GenericEventListSummary_summary",
                "created and configured the room.",
            ).should("exist");

            // Send messages
            cy.get(".mx_RoomView_body .mx_BasicMessageComposer_input").type("Hello Mr. Bot{enter}");
            cy.get(".mx_RoomView_body .mx_BasicMessageComposer_input").type("Hello again, Mr. Bot{enter}");
            // Make sure the second message was sent
            cy.get(".mx_RoomView_MessageList > .mx_EventTile_last .mx_EventTile_receiptSent").should("be.visible");

            // 1. Alignment of collapsed GELS (generic event list summary) and messages
            // Check inline start spacing of collapsed GELS
            // See: _EventTile.pcss
            // .mx_GenericEventListSummary[data-layout="irc"] > .mx_EventTile_line
            //  = var(--name-width) + var(--icon-width) + $MessageTimestamp_width + 2 * var(--right-padding)
            //  = 80 + 14 + 46 + 2 * 5
            //  = 150px
            cy.get(".mx_GenericEventListSummary[data-layout=irc] > .mx_EventTile_line").should(
                "have.css",
                "padding-inline-start",
                "150px",
            );
            // Check width and spacing values of elements in .mx_EventTile, which should be equal to 150px
            // --right-padding should be applied
            cy.get(".mx_EventTile > *").should("have.css", "margin-right", "5px");
            // --name-width width zero inline end margin should be applied
            cy.get(".mx_EventTile .mx_DisambiguatedProfile")
                .should("have.css", "width", "80px")
                .should("have.css", "margin-inline-end", "0px");
            // --icon-width should be applied
            cy.get(".mx_EventTile .mx_EventTile_avatar > .mx_BaseAvatar").should("have.css", "width", "14px");
            // $MessageTimestamp_width should be applied
            cy.get(".mx_EventTile > a").should("have.css", "min-width", "46px");
            // Record alignment of collapsed GELS and messages on messagePanel
            cy.get(".mx_MainSplit").percySnapshotElement("Collapsed GELS and messages on IRC layout", { percyCSS });

            // 2. Alignment of expanded GELS and messages
            // Click "expand" link button
            cy.get(".mx_GenericEventListSummary_toggle[aria-expanded=false]").click();
            // Check inline start spacing of info line on expanded GELS
            cy.get(".mx_EventTile[data-layout=irc].mx_EventTile_info:first-of-type .mx_EventTile_line")
                // See: _EventTile.pcss
                // --EventTile_irc_line_info-margin-inline-start
                // = 80 + 14 + 1 * 5
                .should("have.css", "margin-inline-start", "99px");
            // Record alignment of expanded GELS and messages on messagePanel
            cy.get(".mx_MainSplit").percySnapshotElement("Expanded GELS and messages on IRC layout", { percyCSS });

            // 3. Alignment of expanded GELS and placeholder of deleted message
            // Delete the second (last) message
            cy.get(".mx_RoomView_MessageList > .mx_EventTile_last").realHover();
            cy.get(".mx_RoomView_MessageList > .mx_EventTile_last .mx_MessageActionBar_optionsButton", {
                timeout: 1000,
            })
                .should("exist")
                .realHover()
                .click({ force: false });
            cy.get(".mx_IconizedContextMenu_item[aria-label=Remove]").should("be.visible").click({ force: false });
            // Confirm deletion
            cy.get(".mx_Dialog_buttons button[data-testid=dialog-primary-button]")
                .should("have.text", "Remove")
                .click({ force: false });
            // Make sure the dialog was closed and the second (last) message was redacted
            cy.get(".mx_Dialog").should("not.exist");
            cy.get(".mx_GenericEventListSummary .mx_EventTile_last .mx_RedactedBody").should("be.visible");
            cy.get(".mx_GenericEventListSummary .mx_EventTile_last .mx_EventTile_receiptSent").should("be.visible");
            // Record alignment of expanded GELS and placeholder of deleted message on messagePanel
            cy.get(".mx_MainSplit").percySnapshotElement("Expanded GELS and with placeholder of deleted message", {
                percyCSS,
            });

            // 4. Alignment of expanded GELS, placeholder of deleted message, and emote
            // Send a emote
            cy.get(".mx_RoomView_body .mx_BasicMessageComposer_input").type("/me says hello to Mr. Bot{enter}");
            // Check inline start margin of its avatar
            // Here --right-padding is for the avatar on the message line
            // See: _IRCLayout.pcss
            // .mx_IRCLayout .mx_EventTile_emote .mx_EventTile_avatar
            // = calc(var(--name-width) + var(--icon-width) + 1 * var(--right-padding))
            // = 80 + 14 + 1 * 5
            cy.get(".mx_EventTile_emote .mx_EventTile_avatar").should("have.css", "margin-left", "99px");
            // Make sure emote was sent
            cy.get(".mx_EventTile_last.mx_EventTile_emote .mx_EventTile_receiptSent").should("be.visible");
            // Record alignment of expanded GELS, placeholder of deleted message, and emote
            cy.get(".mx_MainSplit").percySnapshotElement(
                "Expanded GELS and with emote and placeholder of deleted message",
                {
                    percyCSS,
                },
            );
        });

        it("should set inline start padding to a hidden event line", () => {
            sendEvent(roomId);
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);
            cy.contains(
                ".mx_RoomView_body .mx_GenericEventListSummary .mx_GenericEventListSummary_summary",
                "created and configured the room.",
            ).should("exist");

            // Edit message
            cy.contains(".mx_RoomView_body .mx_EventTile .mx_EventTile_line", "Message").within(() => {
                cy.get('[aria-label="Edit"]').click({ force: true }); // Cypress has no ability to hover
                cy.get(".mx_BasicMessageComposer_input").type("Edit{enter}");
            });
            cy.contains(".mx_EventTile[data-scroll-tokens]", "MessageEdit").should("exist");

            // Click timestamp to highlight hidden event line
            cy.get(".mx_RoomView_body .mx_EventTile_info .mx_MessageTimestamp").click();

            // Exclude timestamp and read marker from snapshot
            const percyCSS = ".mx_MessageTimestamp, .mx_RoomView_myReadMarker { visibility: hidden !important; }";

            // should not add inline start padding to a hidden event line on IRC layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            cy.get(".mx_EventTile[data-layout=irc].mx_EventTile_info .mx_EventTile_line").should(
                "have.css",
                "padding-inline-start",
                "0px",
            );

            cy.get(".mx_MainSplit").percySnapshotElement("Hidden event line with zero padding on IRC layout", {
                percyCSS,
            });

            // should add inline start padding to a hidden event line on modern layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            cy.get(".mx_EventTile[data-layout=group].mx_EventTile_info .mx_EventTile_line")
                // calc(var(--EventTile_group_line-spacing-inline-start) + 20px) = 64 + 20 = 84px
                .should("have.css", "padding-inline-start", "84px");

            cy.get(".mx_MainSplit").percySnapshotElement("Hidden event line with padding on modern layout", {
                percyCSS,
            });
        });

        it("should click view source event toggle", () => {
            // This test checks:
            // 1. clickability of top left of view source event toggle
            // 2. clickability of view source toggle on IRC layout

            // Exclude timestamp from snapshot
            const percyCSS = ".mx_MessageTimestamp { visibility: hidden !important; }";

            sendEvent(roomId);
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);
            cy.contains(
                ".mx_RoomView_body .mx_GenericEventListSummary " + ".mx_GenericEventListSummary_summary",
                "created and configured the room.",
            ).should("exist");

            // Edit message
            cy.contains(".mx_RoomView_body .mx_EventTile .mx_EventTile_line", "Message").within(() => {
                cy.get('[aria-label="Edit"]').click({ force: true }); // Cypress has no ability to hover
                cy.get(".mx_BasicMessageComposer_input").type("Edit{enter}");
            });
            cy.contains(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", "MessageEdit").should("exist");

            // 1. clickability of top left of view source event toggle

            // Click top left of the event toggle, which should not be covered by MessageActionBar's safe area
            cy.get(".mx_EventTile_last[data-layout=group] .mx_ViewSourceEvent")
                .should("exist")
                .realHover()
                .within(() => {
                    cy.get(".mx_ViewSourceEvent_toggle").click("topLeft", { force: false });
                });

            // Make sure the expand toggle works
            cy.get(".mx_EventTile_last[data-layout=group] .mx_ViewSourceEvent_expanded")
                .should("be.visible")
                .realHover()
                .within(() => {
                    cy.get(".mx_ViewSourceEvent_toggle")
                        // Check size and position of toggle on expanded view source event
                        // See: _ViewSourceEvent.pcss
                        .should("have.css", "height", "12px") // --ViewSourceEvent_toggle-size
                        .should("have.css", "align-self", "flex-end")

                        // Click again to collapse the source
                        .click("topLeft", { force: false });
                });

            // Make sure the collapse toggle works
            cy.get(".mx_EventTile_last[data-layout=group] .mx_ViewSourceEvent_expanded").should("not.exist");

            // 2. clickability of view source toggle on IRC layout

            // Enable IRC layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Hover the view source toggle on IRC layout
            cy.get(".mx_GenericEventListSummary[data-layout=irc] .mx_EventTile .mx_ViewSourceEvent")
                .should("exist")
                .realHover()
                .percySnapshotElement("Hovered hidden event line on IRC layout", { percyCSS });

            // Click view source event toggle
            cy.get(".mx_GenericEventListSummary[data-layout=irc] .mx_EventTile .mx_ViewSourceEvent")
                .should("exist")
                .realHover()
                .within(() => {
                    cy.get(".mx_ViewSourceEvent_toggle").click("topLeft", { force: false });
                });

            // Make sure the expand toggle worked
            cy.get(".mx_EventTile[data-layout=irc] .mx_ViewSourceEvent_expanded").should("be.visible");
        });

        it("should click 'collapse' link button on the first hovered info event line on bubble layout", () => {
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            cy.contains(
                ".mx_RoomView_body .mx_GenericEventListSummary[data-layout=bubble] " +
                    ".mx_GenericEventListSummary_summary",
                "created and configured the room.",
            ).should("exist");

            // Click "expand" link button
            cy.get(".mx_GenericEventListSummary_toggle[aria-expanded=false]").click();

            // Click "collapse" link button on the first hovered info event line
            cy.get(".mx_GenericEventListSummary_unstyledList .mx_EventTile_info:first-of-type").realHover();
            cy.get(".mx_GenericEventListSummary_toggle[aria-expanded=true]").click({ force: false });

            // Make sure "collapse" link button worked
            cy.get(".mx_GenericEventListSummary_toggle[aria-expanded=false]").should("exist");
        });

        it("should highlight search result words regardless of formatting", () => {
            sendEvent(roomId);
            sendEvent(roomId, true);
            cy.visit("/#/room/" + roomId);

            cy.get(".mx_RoomHeader_searchButton").click();
            cy.get(".mx_SearchBar_input input").type("Message{enter}");

            cy.get(".mx_EventTile:not(.mx_EventTile_contextual) .mx_EventTile_searchHighlight").should("exist");
            cy.get(".mx_RoomView_searchResultsPanel").percySnapshotElement("Highlighted search results");
        });

        it("should render url previews", () => {
            cy.intercept("**/_matrix/media/r0/thumbnail/matrix.org/2022-08-16_yaiSVSRIsNFfxDnV?*", {
                statusCode: 200,
                fixture: "riot.png",
                headers: {
                    "Content-Type": "image/png",
                },
            }).as("mxc");
            cy.intercept("**/_matrix/media/r0/preview_url?url=https%3A%2F%2Fcall.element.io%2F&ts=*", {
                statusCode: 200,
                body: {
                    "og:title": "Element Call",
                    "og:description": null,
                    "og:image:width": 48,
                    "og:image:height": 48,
                    "og:image": "mxc://matrix.org/2022-08-16_yaiSVSRIsNFfxDnV",
                    "og:image:type": "image/png",
                    "matrix:image:size": 2121,
                },
                headers: {
                    "Content-Type": "application/json",
                },
            }).as("preview_url");

            cy.sendEvent(roomId, null, "m.room.message" as EventType, {
                msgtype: "m.text" as MsgType,
                body: "https://call.element.io/",
            });
            cy.visit("/#/room/" + roomId);

            cy.get(".mx_LinkPreviewWidget").should("exist").should("contain.text", "Element Call");

            cy.wait("@preview_url");
            cy.wait("@mxc");

            cy.checkA11y();

            // Exclude timestamp and read marker from snapshot
            const percyCSS = ".mx_MessageTimestamp, .mx_RoomView_myReadMarker { visibility: hidden !important; }";
            cy.get(".mx_EventTile_last").percySnapshotElement("URL Preview", {
                percyCSS,
                widths: [800, 400],
            });
        });
    });

    describe("message sending", () => {
        const MESSAGE = "Hello world";
        const reply = "Reply";
        const viewRoomSendMessageAndSetupReply = () => {
            // View room
            cy.visit("/#/room/" + roomId);

            // Send a message
            cy.getComposer().type(`${MESSAGE}{enter}`);

            // Reply to the message
            cy.contains(".mx_RoomView_body .mx_EventTile_line", "Hello world").within(() => {
                cy.get('[aria-label="Reply"]').click({ force: true }); // Cypress has no ability to hover
            });
        };

        it("can reply with a text message", () => {
            viewRoomSendMessageAndSetupReply();

            cy.getComposer().type(`${reply}{enter}`);

            cy.get(".mx_RoomView_body .mx_EventTile .mx_EventTile_line .mx_ReplyTile .mx_MTextBody").should(
                "contain",
                MESSAGE,
            );
            cy.contains(".mx_RoomView_body .mx_EventTile > .mx_EventTile_line > .mx_MTextBody", reply).should(
                "have.length",
                1,
            );
        });

        it("can reply with a voice message", () => {
            viewRoomSendMessageAndSetupReply();

            cy.openMessageComposerOptions().within(() => {
                cy.get(`[aria-label="Voice Message"]`).click();
            });
            cy.wait(3000);
            cy.get(".mx_RoomView_body .mx_MessageComposer .mx_MessageComposer_sendMessage").click();

            cy.get(".mx_RoomView_body .mx_EventTile .mx_EventTile_line .mx_ReplyTile .mx_MTextBody").should(
                "contain",
                MESSAGE,
            );
            cy.get(".mx_RoomView_body .mx_EventTile > .mx_EventTile_line > .mx_MVoiceMessageBody").should(
                "have.length",
                1,
            );
        });

        it("should not be possible to send flag with regional emojis", () => {
            cy.visit("/#/room/" + roomId);

            // Send a message
            cy.getComposer().type(":regional_indicator_a");
            cy.contains(".mx_Autocomplete_Completion_title", ":regional_indicator_a:").click();
            cy.getComposer().type(":regional_indicator_r");
            cy.contains(".mx_Autocomplete_Completion_title", ":regional_indicator_r:").click();
            cy.getComposer().type(" :regional_indicator_z");
            cy.contains(".mx_Autocomplete_Completion_title", ":regional_indicator_z:").click();
            cy.getComposer().type(":regional_indicator_a");
            cy.contains(".mx_Autocomplete_Completion_title", ":regional_indicator_a:").click();
            cy.getComposer().type("{enter}");

            cy.get(".mx_RoomView_body .mx_EventTile .mx_EventTile_line .mx_MTextBody .mx_EventTile_bigEmoji")
                .children()
                .should("have.length", 4);
        });

        it("should display a reply chain", () => {
            let bot: MatrixClient;
            const reply2 = "Reply again";

            // For clicking the reply button on the last line
            const clickButtonReply = () => {
                cy.get(".mx_RoomView_MessageList").within(() => {
                    cy.get(".mx_EventTile_last").realHover();
                    cy.get(".mx_EventTile_last .mx_MessageActionBar_optionsButton", {
                        timeout: 1000,
                    })
                        .should("exist")
                        .realHover()
                        .get('.mx_EventTile_last [aria-label="Reply"]')
                        .click({ force: false });
                });
            };

            cy.visit("/#/room/" + roomId);

            // Wait until configuration is finished
            cy.contains(
                ".mx_RoomView_body .mx_GenericEventListSummary .mx_GenericEventListSummary_summary",
                "created and configured the room.",
            ).should("exist");

            // Create a bot "BotBob" and invite it
            cy.getBot(homeserver, {
                displayName: "BotBob",
                autoAcceptInvites: false,
            }).then((_bot) => {
                bot = _bot;
                cy.inviteUser(roomId, bot.getUserId());
                bot.joinRoom(roomId);

                // Make sure the bot joined the room
                cy.contains(
                    ".mx_GenericEventListSummary .mx_EventTile_info.mx_EventTile_last",
                    "BotBob joined the room",
                ).should("exist");

                // Have bot send MESSAGE to roomId
                cy.botSendMessage(bot, roomId, MESSAGE);
            });

            // Reply to the message
            clickButtonReply();
            cy.getComposer().type(`${reply}{enter}`);

            // Make sure 'reply' was sent
            cy.contains(".mx_RoomView_MessageList .mx_EventTile_last", reply).should("exist");

            // Reply again to create a replyChain
            clickButtonReply();
            cy.getComposer().type(`${reply2}{enter}`);

            // Make sure 'reply2' was sent
            cy.contains(".mx_RoomView_MessageList .mx_EventTile_last", reply2).should("exist");

            // Exclude timestamp and read marker from snapshot
            const percyCSS = ".mx_MessageTimestamp, .mx_RoomView_myReadMarker { visibility: hidden !important; }";

            // Check the margin value of ReplyChains of EventTile at the bottom on IRC layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            cy.get(".mx_EventTile_last[data-layout='irc'] .mx_ReplyChain").should("have.css", "margin", "0px");

            // Take a snapshot on IRC layout
            cy.get(".mx_EventTile_last").percySnapshotElement("EventTile with reply chains on IRC layout", {
                percyCSS,
            });

            // Check the margin value of ReplyChains of EventTile at the bottom on group/modern layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            cy.get(".mx_EventTile_last[data-layout='group'] .mx_ReplyChain").should("have.css", "margin-bottom", "8px");

            // Take a snapshot on modern layout
            cy.get(".mx_EventTile_last").percySnapshotElement("EventTile with reply chains on modern layout", {
                percyCSS,
            });

            // Check the margin value of ReplyChains of EventTile at the bottom on group/modern compact layout
            cy.setSettingValue("useCompactLayout", null, SettingLevel.DEVICE, true);
            cy.get(".mx_EventTile_last[data-layout='group'] .mx_ReplyChain").should("have.css", "margin-bottom", "4px");

            // Take a snapshot on compact modern layout
            cy.get(".mx_EventTile_last").percySnapshotElement("EventTile with reply chains on compact modern layout", {
                percyCSS,
            });

            // Check the margin value of ReplyChains of EventTile at the bottom on bubble layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            cy.get(".mx_EventTile_last[data-layout='bubble'] .mx_ReplyChain").should(
                "have.css",
                "margin-bottom",
                "8px",
            );

            // Take a snapshot on bubble layout
            cy.get(".mx_EventTile_last").percySnapshotElement("EventTile with reply chains on bubble layout", {
                percyCSS,
            });
        });

        it("should send, reply, and display long strings without overflowing", () => {
            // Max 256 characters for display name
            const LONG_STRING =
                "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut " +
                "et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut " +
                "aliquip";

            // Create a bot with a long display name
            let bot: MatrixClient;
            cy.getBot(homeserver, {
                displayName: LONG_STRING,
                autoAcceptInvites: false,
            }).then((_bot) => {
                bot = _bot;
            });

            // Create another room with a long name, invite the bot, and open the room
            cy.createRoom({ name: LONG_STRING })
                .as("testRoomId")
                .then((_roomId) => {
                    roomId = _roomId;
                    cy.inviteUser(roomId, bot.getUserId());
                    bot.joinRoom(roomId);
                    cy.visit("/#/room/" + roomId);
                });

            // Wait until configuration is finished
            cy.contains(
                ".mx_RoomView_body .mx_GenericEventListSummary .mx_GenericEventListSummary_summary",
                "created and configured the room.",
            ).should("exist");

            // Set the display name to "LONG_STRING 2" in order to avoid a warning in Percy tests from being triggered
            // due to the generated random mxid being displayed inside the GELS summary.
            cy.setDisplayName(`${LONG_STRING} 2`);

            // Have the bot send a long message
            cy.get<string>("@testRoomId").then((roomId) => {
                bot.sendMessage(roomId, {
                    body: LONG_STRING,
                    msgtype: "m.text",
                });
            });

            // Wait until the message is rendered
            cy.get(".mx_EventTile_last .mx_MTextBody .mx_EventTile_body").should("have.text", LONG_STRING);

            // Reply to the message
            cy.get(".mx_EventTile_last")
                .realHover()
                .within(() => {
                    cy.get('[aria-label="Reply"]').click({ force: false });
                });
            cy.getComposer().type(`${reply}{enter}`);

            // Make sure the reply tile and the reply are displayed
            cy.get(".mx_EventTile_last").within(() => {
                cy.get(".mx_ReplyTile .mx_MTextBody").should("have.text", LONG_STRING);
                cy.get(".mx_EventTile_line > .mx_MTextBody").should("have.text", reply);
            });

            // Exclude timestamp and read marker from snapshots
            const percyCSS = ".mx_MessageTimestamp, .mx_RoomView_myReadMarker { visibility: hidden !important; }";

            // Make sure the strings do not overflow on IRC layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            cy.get(".mx_MainSplit").percySnapshotElement("Long strings with a reply on IRC layout", { percyCSS });

            // Make sure the strings do not overflow on modern layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            cy.get(".mx_EventTile_last[data-layout='group'] .mx_EventTile_line > .mx_MTextBody").should(
                "have.text",
                reply,
            );
            cy.get(".mx_MainSplit").percySnapshotElement("Long strings with a reply on modern layout", { percyCSS });

            // Make sure the strings do not overflow on bubble layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            cy.get(".mx_EventTile_last[data-layout='bubble'] .mx_EventTile_line > .mx_MTextBody").should(
                "have.text",
                reply,
            );
            cy.get(".mx_MainSplit").percySnapshotElement("Long strings with a reply on bubble layout", { percyCSS });
        });
    });
});
