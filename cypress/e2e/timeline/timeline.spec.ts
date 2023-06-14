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

    describe("configure room", () => {
        // Exclude timestamp and read marker from snapshots
        const percyCSS = ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";

        beforeEach(() => {
            cy.injectAxe();
        });

        it("should create and configure a room on IRC layout", () => {
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            cy.get(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='irc']").within(() => {
                cy.get(".mx_GenericEventListSummary_summary")
                    .findByText(OLD_NAME + " created and configured the room.")
                    .should("exist");
            });

            cy.get(".mx_IRCLayout").within(() => {
                // Check room name line-height is reset
                cy.get(".mx_NewRoomIntro h2").should("have.css", "line-height", "normal");

                // Check the profile resizer's place
                // See: _IRCLayout
                // --RoomView_MessageList-padding = 18px (See: _RoomView.pcss)
                // --MessageTimestamp-width = 46px (See: _MessageTimestamp.pcss)
                // --icon-width = 14px
                // --right-padding = 5px
                // --name-width = 80px
                // --resizer-width = 15px
                // --resizer-a11y = 3px
                // 18px + 46px + 14px + 5px + 80px + 5px - 15px - 3px
                // = 150px
                cy.get(".mx_ProfileResizer").should("have.css", "inset-inline-start", "150px");
            });

            cy.get(".mx_MainSplit").percySnapshotElement("Configured room on IRC layout");
        });

        it("should have an expanded generic event list summary (GELS) on IRC layout", () => {
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            cy.get(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='irc']").within(() => {
                cy.get(".mx_GenericEventListSummary_summary")
                    .findByText(OLD_NAME + " created and configured the room.")
                    .should("exist");
            });

            cy.get(".mx_GenericEventListSummary").within(() => {
                // Click "expand" link button
                cy.findByRole("button", { name: "expand" }).click();

                // Assert that the "expand" link button worked
                cy.findByRole("button", { name: "collapse" }).should("exist");
            });

            // Check the height of expanded GELS line
            cy.get(".mx_GenericEventListSummary[data-layout=irc] .mx_GenericEventListSummary_spacer").should(
                "have.css",
                "line-height",
                "18px", // var(--irc-line-height): $font-18px (See: _IRCLayout.pcss)
            );

            cy.get(".mx_MainSplit").percySnapshotElement("Expanded GELS on IRC layout", { percyCSS });
        });

        it("should have an expanded generic event list summary (GELS) on compact modern/group layout", () => {
            cy.visit("/#/room/" + roomId);

            // Set compact modern layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group).setSettingValue(
                "useCompactLayout",
                null,
                SettingLevel.DEVICE,
                true,
            );

            // Wait until configuration is finished
            cy.get(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='group']")
                .findByText(OLD_NAME + " created and configured the room.")
                .should("exist");

            cy.get(".mx_GenericEventListSummary").within(() => {
                // Click "expand" link button
                cy.findByRole("button", { name: "expand" }).click();

                // Assert that the "expand" link button worked
                cy.findByRole("button", { name: "collapse" }).should("exist");
            });

            // Check the height of expanded GELS line
            cy.get(".mx_GenericEventListSummary[data-layout=group] .mx_GenericEventListSummary_spacer").should(
                "have.css",
                "line-height",
                "22px", // $font-22px (See: _GenericEventListSummary.pcss)
            );

            cy.get(".mx_MainSplit").percySnapshotElement("Expanded GELS on modern layout", { percyCSS });
        });

        it("should click 'collapse' on the first hovered info event line inside GELS on bubble layout", () => {
            // This test checks clickability of the "Collapse" link button, which had been covered with
            // MessageActionBar's safe area - https://github.com/vector-im/element-web/issues/22864

            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            cy.get(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='bubble']").within(() => {
                cy.get(".mx_GenericEventListSummary_summary")
                    .findByText(OLD_NAME + " created and configured the room.")
                    .should("exist");
            });

            cy.get(".mx_GenericEventListSummary").within(() => {
                // Click "expand" link button
                cy.findByRole("button", { name: "expand" }).click();

                // Assert that the "expand" link button worked
                cy.findByRole("button", { name: "collapse" }).should("exist");
            });

            // Make sure spacer is not visible on bubble layout
            cy.get(".mx_GenericEventListSummary[data-layout=bubble] .mx_GenericEventListSummary_spacer").should(
                "not.be.visible", // See: _GenericEventListSummary.pcss
            );

            // Exclude timestamp from snapshot
            const percyCSS = ".mx_MessageTimestamp { visibility: hidden !important; }";

            // Save snapshot of expanded generic event list summary on bubble layout
            cy.get(".mx_MainSplit").percySnapshotElement("Expanded GELS on bubble layout", { percyCSS });

            cy.get(".mx_GenericEventListSummary").within(() => {
                // Click "collapse" link button on the first hovered info event line
                cy.get(".mx_GenericEventListSummary_unstyledList .mx_EventTile_info:first-of-type")
                    .realHover()
                    .findByRole("toolbar", { name: "Message Actions" })
                    .should("be.visible");
                cy.findByRole("button", { name: "collapse" }).click();

                // Assert that "collapse" link button worked
                cy.findByRole("button", { name: "expand" }).should("exist");
            });

            // Save snapshot of collapsed generic event list summary on bubble layout
            cy.get(".mx_MainSplit").percySnapshotElement("Collapsed GELS on bubble layout", { percyCSS });
        });

        it("should add inline start margin to an event line on IRC layout", () => {
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            cy.get(".mx_RoomView_body .mx_GenericEventListSummary[data-layout='irc']").within(() => {
                cy.get(".mx_GenericEventListSummary_summary")
                    .findByText(OLD_NAME + " created and configured the room.")
                    .should("exist");
            });

            // Click "expand" link button
            cy.get(".mx_GenericEventListSummary").findByRole("button", { name: "expand" }).click();

            // Check the event line has margin instead of inset property
            // cf. _EventTile.pcss
            //  --EventTile_irc_line_info-margin-inline-start
            //  = calc(var(--name-width) + var(--icon-width) + 1 * var(--right-padding))
            //  = 80 + 14 + 5 = 99px

            cy.get(".mx_EventTile[data-layout=irc].mx_EventTile_info:first-of-type .mx_EventTile_line")
                .should("have.css", "margin-inline-start", "99px")
                .should("have.css", "inset-inline-start", "0px");

            // Exclude timestamp and read marker from snapshot
            const percyCSS = ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";
            cy.get(".mx_MainSplit").percySnapshotElement("Event line with inline start margin on IRC layout", {
                percyCSS,
            });
            cy.checkA11y();
        });
    });

    describe("message displaying", () => {
        beforeEach(() => {
            cy.injectAxe();
        });

        const messageEdit = () => {
            cy.contains(".mx_EventTile .mx_EventTile_line", "Message")
                .realHover()
                .findByRole("toolbar", { name: "Message Actions" })
                .findByRole("button", { name: "Edit" })
                .click();
            cy.findByRole("textbox", { name: "Edit message" }).type("Edit{enter}");

            // Assert that the edited message and the link button are found
            cy.contains(".mx_EventTile .mx_EventTile_line", "MessageEdit").within(() => {
                // Regex patterns due to the edited date
                cy.findByRole("button", { name: /Edited at .*? Click to view edits./ });
            });
        };

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
            cy.get(".mx_GenericEventListSummary_summary").within(() => {
                cy.findByText(OLD_NAME + " created and configured the room.").should("exist");
            });

            // Send messages
            cy.get(".mx_RoomView_body").within(() => {
                cy.findByRole("textbox", { name: "Send a message…" }).type("Hello Mr. Bot{enter}");
                cy.findByRole("textbox", { name: "Send a message…" }).type("Hello again, Mr. Bot{enter}");
            });

            // Make sure the second message was sent
            cy.get(".mx_RoomView_MessageList > .mx_EventTile_last .mx_EventTile_receiptSent").should("be.visible");

            // 1. Alignment of collapsed GELS (generic event list summary) and messages
            // Check inline start spacing of collapsed GELS
            // See: _EventTile.pcss
            // .mx_GenericEventListSummary[data-layout="irc"] > .mx_EventTile_line
            //  = var(--name-width) + var(--icon-width) + var(--MessageTimestamp-width) + 2 * var(--right-padding)
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
            // var(--MessageTimestamp-width) should be applied
            cy.get(".mx_EventTile > a").should("have.css", "min-width", "46px");
            // Record alignment of collapsed GELS and messages on messagePanel
            cy.get(".mx_MainSplit").percySnapshotElement("Collapsed GELS and messages on IRC layout", { percyCSS });

            // 2. Alignment of expanded GELS and messages
            // Click "expand" link button
            cy.get(".mx_GenericEventListSummary").findByRole("button", { name: "expand" }).click();
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
            cy.get(".mx_RoomView_MessageList > .mx_EventTile_last")
                .realHover()
                .findByRole("button", { name: "Options" })
                .should("be.visible")
                .click();
            cy.findByRole("menuitem", { name: "Remove" }).should("be.visible").click();
            // Confirm deletion
            cy.get(".mx_Dialog_buttons").within(() => {
                cy.findByRole("button", { name: "Remove" }).click();
            });
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
            cy.get(".mx_RoomView_body").within(() => {
                cy.findByRole("textbox", { name: "Send a message…" }).type("/me says hello to Mr. Bot{enter}");
            });
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

        it("should render EventTiles on IRC, modern (group), and bubble layout", () => {
            const percyCSS =
                // Hide because flaky - See https://github.com/vector-im/element-web/issues/24957
                ".mx_TopUnreadMessagesBar, " +
                // Exclude timestamp and read marker from snapshots
                ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";

            sendEvent(roomId);
            sendEvent(roomId); // check continuation
            sendEvent(roomId); // check the last EventTile

            cy.visit("/#/room/" + roomId);

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // IRC layout
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////

            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            cy.get(".mx_GenericEventListSummary_summary").within(() => {
                cy.findByText(OLD_NAME + " created and configured the room.").should("exist");
            });

            cy.get(".mx_RoomView_body[data-layout=irc]").within(() => {
                // Ensure CSS declarations which cannot be detected with a screenshot test are applied as expected
                cy.get(".mx_EventTile")
                    .should("have.css", "max-width", "100%")
                    .should("have.css", "clear", "both")
                    .should("have.css", "position", "relative");

                // Check mx_EventTile_continuation
                // Block start padding of the second message should not be overridden
                cy.get(".mx_EventTile_continuation").should("have.css", "padding-block-start", "0px");
                cy.get(".mx_EventTile_continuation .mx_EventTile_line").should("have.css", "clear", "both");

                // Select the last event tile
                cy.get(".mx_EventTile_last")
                    .within(() => {
                        // The last tile is also a continued one
                        cy.get(".mx_EventTile_line").should("have.css", "clear", "both");
                    })
                    // Check that zero block padding is set
                    .should("have.css", "padding-block-start", "0px");
            });

            cy.get(".mx_MainSplit").percySnapshotElement("EventTiles on IRC layout", { percyCSS });

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // Group/modern layout
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////

            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);

            cy.get(".mx_RoomView_body[data-layout=group]").within(() => {
                // Ensure CSS declarations which cannot be detected with a screenshot test are applied as expected
                cy.get(".mx_EventTile")
                    .should("have.css", "max-width", "100%")
                    .should("have.css", "clear", "both")
                    .should("have.css", "position", "relative");

                // Check mx_EventTile_continuation
                // Block start padding of the second message should not be overridden
                cy.get(".mx_EventTile_continuation").should("have.css", "padding-block-start", "0px");
                cy.get(".mx_EventTile_continuation .mx_EventTile_line").should("have.css", "clear", "both");

                // Check that the last EventTile is rendered
                cy.get(".mx_EventTile.mx_EventTile_last").should("exist");
            });

            cy.get(".mx_MainSplit").percySnapshotElement("EventTiles on modern layout", { percyCSS });

            // Check the same thing for compact layout
            cy.setSettingValue("useCompactLayout", null, SettingLevel.DEVICE, true);

            cy.get(".mx_MatrixChat_useCompactLayout").within(() => {
                // Ensure CSS declarations which cannot be detected with a screenshot test are applied as expected
                cy.get(".mx_EventTile")
                    .should("have.css", "max-width", "100%")
                    .should("have.css", "clear", "both")
                    .should("have.css", "position", "relative");

                // Check cascading works
                cy.get(".mx_EventTile_continuation").should("have.css", "padding-block-start", "0px");

                // Check that the last EventTile is rendered
                cy.get(".mx_EventTile.mx_EventTile_last").should("exist");
            });

            cy.get(".mx_MainSplit").percySnapshotElement("EventTiles on compact modern layout", { percyCSS });

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // Message bubble layout
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////

            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);

            cy.get(".mx_RoomView_body[data-layout=bubble]").within(() => {
                // Ensure CSS declarations which cannot be detected with a screenshot test are applied as expected
                cy.get(".mx_EventTile")
                    .should("have.css", "max-width", "none")
                    .should("have.css", "clear", "both")
                    .should("have.css", "position", "relative");

                // Check that block start padding of the second message is not overridden
                cy.get(".mx_EventTile.mx_EventTile_continuation").should("have.css", "margin-block-start", "2px");

                // Select the last bubble
                cy.get(".mx_EventTile_last")
                    .within(() => {
                        // calc(var(--gutterSize) - 1px)
                        cy.get(".mx_EventTile_line").should("have.css", "padding-block-start", "10px");
                    })
                    .should("have.css", "margin-block-start", "2px"); // The last bubble is also a continued one
            });

            cy.get(".mx_MainSplit").percySnapshotElement("EventTiles on bubble layout", { percyCSS });
        });

        it("should set inline start padding to a hidden event line", () => {
            sendEvent(roomId);
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);
            cy.get(".mx_GenericEventListSummary_summary").within(() => {
                cy.findByText(OLD_NAME + " created and configured the room.").should("exist");
            });

            // Edit message
            messageEdit();

            // Click timestamp to highlight hidden event line
            cy.get(".mx_RoomView_body .mx_EventTile_info .mx_MessageTimestamp").click();

            // Exclude timestamp and read marker from snapshot
            //const percyCSS = ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";

            // should not add inline start padding to a hidden event line on IRC layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            cy.get(".mx_EventTile[data-layout=irc].mx_EventTile_info .mx_EventTile_line").should(
                "have.css",
                "padding-inline-start",
                "0px",
            );

            // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24881
            /*cy.get(".mx_MainSplit").percySnapshotElement("Hidden event line with zero padding on IRC layout", {
                percyCSS,
            });*/

            // should add inline start padding to a hidden event line on modern layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            cy.get(".mx_EventTile[data-layout=group].mx_EventTile_info .mx_EventTile_line")
                // calc(var(--EventTile_group_line-spacing-inline-start) + 20px) = 64 + 20 = 84px
                .should("have.css", "padding-inline-start", "84px");

            // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24881
            //cy.get(".mx_MainSplit").percySnapshotElement("Hidden event line with padding on modern layout", {
            //    percyCSS,
            //});
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
            cy.get(".mx_GenericEventListSummary_summary").within(() => {
                cy.findByText(OLD_NAME + " created and configured the room.").should("exist");
            });

            // Edit message
            messageEdit();

            // 1. clickability of top left of view source event toggle

            // Click top left of the event toggle, which should not be covered by MessageActionBar's safe area
            cy.get(".mx_EventTile_last[data-layout=group] .mx_ViewSourceEvent")
                .should("exist")
                .realHover()
                .within(() => {
                    cy.findByRole("button", { name: "toggle event" }).click("topLeft");
                });

            // Make sure the expand toggle works
            cy.get(".mx_EventTile_last[data-layout=group] .mx_ViewSourceEvent_expanded")
                .should("be.visible")
                .realHover()
                .within(() => {
                    cy.findByRole("button", { name: "toggle event" })
                        // Check size and position of toggle on expanded view source event
                        // See: _ViewSourceEvent.pcss
                        .should("have.css", "height", "12px") // --ViewSourceEvent_toggle-size
                        .should("have.css", "align-self", "flex-end")

                        // Click again to collapse the source
                        .click("topLeft");
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
                    cy.findByRole("button", { name: "toggle event" }).click("topLeft");
                });

            // Make sure the expand toggle worked
            cy.get(".mx_EventTile[data-layout=irc] .mx_ViewSourceEvent_expanded").should("be.visible");
        });

        it("should render file size in kibibytes on a file tile", () => {
            cy.visit("/#/room/" + roomId);
            cy.get(".mx_GenericEventListSummary_summary").within(() => {
                cy.findByText(OLD_NAME + " created and configured the room.").should("exist");
            });

            // Upload a file from the message composer
            cy.get(".mx_MessageComposer_actions input[type='file']").selectFile(
                "cypress/fixtures/matrix-org-client-versions.json",
                { force: true },
            );

            cy.get(".mx_Dialog").within(() => {
                // Click "Upload" button
                cy.findByRole("button", { name: "Upload" }).click();
            });

            // Wait until the file is sent
            cy.get(".mx_RoomView_statusArea_expanded").should("not.exist");
            cy.get(".mx_EventTile.mx_EventTile_last .mx_EventTile_receiptSent").should("exist");

            // Assert that the file size is displayed in kibibytes (1024 bytes), not kilobytes (1000 bytes)
            // See: https://github.com/vector-im/element-web/issues/24866
            cy.get(".mx_EventTile_last").within(() => {
                // actual file size in kibibytes
                cy.get(".mx_MFileBody_info_filename")
                    .findByText(/1.12 KB/)
                    .should("exist");
            });
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

            cy.get(".mx_LinkPreviewWidget").should("exist").findByText("Element Call");

            cy.wait("@preview_url");
            cy.wait("@mxc");

            cy.checkA11y();

            // Exclude timestamp and read marker from snapshot
            const percyCSS = ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";
            cy.get(".mx_EventTile_last").percySnapshotElement("URL Preview", {
                percyCSS,
                widths: [800, 400],
            });
        });

        describe("on search results panel", () => {
            it("should highlight search result words regardless of formatting", () => {
                sendEvent(roomId);
                sendEvent(roomId, true);
                cy.visit("/#/room/" + roomId);

                cy.get(".mx_RoomHeader").findByRole("button", { name: "Search" }).click();

                cy.get(".mx_SearchBar").percySnapshotElement("Search bar on the timeline", {
                    // Emulate narrow timeline
                    widths: [320, 640],
                });

                cy.get(".mx_SearchBar_input").findByRole("textbox").type("Message{enter}");

                cy.get(".mx_EventTile:not(.mx_EventTile_contextual) .mx_EventTile_searchHighlight").should("exist");
                cy.get(".mx_RoomView_searchResultsPanel").percySnapshotElement("Highlighted search results");
            });

            it("should render a fully opaque textual event", () => {
                const stringToSearch = "Message"; // Same with string sent with sendEvent()

                sendEvent(roomId);

                cy.visit("/#/room/" + roomId);

                // Open a room setting dialog
                cy.findByRole("button", { name: "Room options" }).click();
                cy.findByRole("menuitem", { name: "Settings" }).click();

                // Set a room topic to render a TextualEvent
                cy.findByRole("textbox", { name: "Room Topic" }).type(`This is a room for ${stringToSearch}.`);
                cy.findByRole("button", { name: "Save" }).click();

                cy.closeDialog();

                // Assert that the TextualEvent is rendered
                cy.findByText(`${OLD_NAME} changed the topic to "This is a room for ${stringToSearch}.".`)
                    .should("exist")
                    .should("have.class", "mx_TextualEvent");

                // Display the room search bar
                cy.get(".mx_RoomHeader").findByRole("button", { name: "Search" }).click();

                // Search the string to display both the message and TextualEvent on search results panel
                cy.get(".mx_SearchBar").within(() => {
                    cy.findByRole("textbox").type(`${stringToSearch}{enter}`);
                });

                // On search results panel
                cy.get(".mx_RoomView_searchResultsPanel").within(() => {
                    // Assert that contextual event tiles are translucent
                    cy.get(".mx_EventTile.mx_EventTile_contextual").should("have.css", "opacity", "0.4");

                    // Assert that the TextualEvent is fully opaque (visually solid).
                    cy.get(".mx_EventTile .mx_TextualEvent").should("have.css", "opacity", "1");
                });

                cy.get(".mx_RoomView_searchResultsPanel").percySnapshotElement("Search results - with TextualEvent");
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
            cy.get(".mx_EventTile_last")
                .within(() => {
                    cy.findByText(MESSAGE);
                })
                .realHover()
                .findByRole("button", { name: "Reply" })
                .click();
        };

        // For clicking the reply button on the last line
        const clickButtonReply = () => {
            cy.get(".mx_RoomView_MessageList").within(() => {
                cy.get(".mx_EventTile_last").realHover().findByRole("button", { name: "Reply" }).click();
            });
        };

        it("can reply with a text message", () => {
            viewRoomSendMessageAndSetupReply();

            cy.getComposer().type(`${reply}{enter}`);

            cy.get(".mx_RoomView_body").within(() => {
                cy.get(".mx_EventTile_last .mx_EventTile_line").within(() => {
                    cy.get(".mx_ReplyTile .mx_MTextBody").within(() => {
                        cy.findByText(MESSAGE).should("exist");
                    });

                    cy.findByText(reply).should("have.length", 1);
                });
            });
        });

        it("can reply with a voice message", () => {
            viewRoomSendMessageAndSetupReply();

            cy.openMessageComposerOptions().within(() => {
                cy.findByRole("menuitem", { name: "Voice Message" }).click();
            });

            // Record an empty message
            cy.wait(3000);

            cy.get(".mx_RoomView_body").within(() => {
                cy.get(".mx_MessageComposer").findByRole("button", { name: "Send voice message" }).click();

                cy.get(".mx_EventTile_last .mx_EventTile_line").within(() => {
                    cy.get(".mx_ReplyTile .mx_MTextBody").within(() => {
                        cy.findByText(MESSAGE).should("exist");
                    });

                    cy.get(".mx_MVoiceMessageBody").should("have.length", 1);
                });
            });
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

            cy.visit("/#/room/" + roomId);

            // Wait until configuration is finished
            cy.get(".mx_GenericEventListSummary_summary").within(() => {
                cy.findByText(OLD_NAME + " created and configured the room.").should("exist");
            });

            // Create a bot "BotBob" and invite it
            cy.getBot(homeserver, {
                displayName: "BotBob",
                autoAcceptInvites: false,
            }).then((_bot) => {
                bot = _bot;
                cy.inviteUser(roomId, bot.getUserId());
                bot.joinRoom(roomId);

                // Make sure the bot joined the room
                cy.get(".mx_GenericEventListSummary .mx_EventTile_info.mx_EventTile_last").within(() => {
                    cy.findByText("BotBob joined the room").should("exist");
                });

                // Have bot send MESSAGE to roomId
                cy.botSendMessage(bot, roomId, MESSAGE);
            });

            // Assert that MESSAGE is found
            cy.findByText(MESSAGE);

            // Reply to the message
            clickButtonReply();
            cy.getComposer().type(`${reply}{enter}`);

            // Make sure 'reply' was sent
            cy.get(".mx_RoomView_body .mx_EventTile_last").within(() => {
                cy.findByText(reply).should("exist");
            });

            // Reply again to create a replyChain
            clickButtonReply();
            cy.getComposer().type(`${reply2}{enter}`);

            // Assert that 'reply2' was sent
            cy.get(".mx_RoomView_body .mx_EventTile_last").within(() => {
                cy.findByText(reply2).should("exist");
            });

            cy.get(".mx_EventTile_last .mx_EventTile_receiptSent").should("be.visible");

            // Exclude timestamp and read marker from snapshot
            const percyCSS = ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";

            // Check the margin value of ReplyChains of EventTile at the bottom on IRC layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            cy.get(".mx_EventTile_last[data-layout='irc'] .mx_ReplyChain").should("have.css", "margin", "0px");

            // Take a snapshot on IRC layout
            // Note that because zero margin is applied to mx_ReplyChain, the left borders of two mx_ReplyChain
            // components may seem to be connected to one.
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
            cy.get(".mx_GenericEventListSummary_summary").within(() => {
                cy.findByText(OLD_NAME + " created and configured the room.").should("exist");
            });

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
            cy.get(".mx_EventTile_last .mx_MTextBody .mx_EventTile_body").within(() => {
                cy.findByText(LONG_STRING);
            });

            // Reply to the message
            clickButtonReply();
            cy.getComposer().type(`${reply}{enter}`);

            // Make sure the reply tile is rendered
            cy.get(".mx_EventTile_last .mx_EventTile_line").within(() => {
                cy.get(".mx_ReplyTile .mx_MTextBody").within(() => {
                    cy.findByText(LONG_STRING).should("exist");
                });

                cy.findByText(reply).should("have.length", 1);
            });

            // Change the viewport size
            cy.viewport(1600, 1200);

            // Exclude timestamp and read marker from snapshots
            //const percyCSS = ".mx_MessageTimestamp, .mx_MessagePanel_myReadMarker { visibility: hidden !important; }";

            // Make sure the strings do not overflow on IRC layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            // Scroll to the bottom to have Percy take a snapshot of the whole viewport
            cy.get(".mx_ScrollPanel").scrollTo("bottom", { ensureScrollable: false });
            // Assert that both avatar in the introduction and the last message are visible at the same time
            cy.get(".mx_NewRoomIntro .mx_BaseAvatar").should("be.visible");
            cy.get(".mx_EventTile_last[data-layout='irc']").within(() => {
                cy.get(".mx_MTextBody").should("be.visible");
                cy.get(".mx_EventTile_receiptSent").should("be.visible"); // rendered at the bottom of EventTile
            });
            // Take a snapshot in IRC layout
            // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24881
            //cy.get(".mx_ScrollPanel").percySnapshotElement("Long strings with a reply on IRC layout", { percyCSS });

            // Make sure the strings do not overflow on modern layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            cy.get(".mx_ScrollPanel").scrollTo("bottom", { ensureScrollable: false }); // Scroll again in case
            cy.get(".mx_NewRoomIntro .mx_BaseAvatar").should("be.visible");
            cy.get(".mx_EventTile_last[data-layout='group']").within(() => {
                cy.get(".mx_MTextBody").should("be.visible");
                cy.get(".mx_EventTile_receiptSent").should("be.visible");
            });
            // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24881
            //cy.get(".mx_ScrollPanel").percySnapshotElement("Long strings with a reply on modern layout", { percyCSS });

            // Make sure the strings do not overflow on bubble layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            cy.get(".mx_ScrollPanel").scrollTo("bottom", { ensureScrollable: false }); // Scroll again in case
            cy.get(".mx_NewRoomIntro .mx_BaseAvatar").should("be.visible");
            cy.get(".mx_EventTile_last[data-layout='bubble']").within(() => {
                cy.get(".mx_MTextBody").should("be.visible");
                cy.get(".mx_EventTile_receiptSent").should("be.visible");
            });
            // Disabled because flaky - see https://github.com/vector-im/element-web/issues/24881
            //cy.get(".mx_ScrollPanel").percySnapshotElement("Long strings with a reply on bubble layout", { percyCSS });
        });
    });
});
