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

import { MessageEvent } from "matrix-events-sdk";

import type { ISendEventResponse } from "matrix-js-sdk/src/@types/requests";
import type { EventType } from "matrix-js-sdk/src/@types/event";
import { SynapseInstance } from "../../plugins/synapsedocker";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Layout } from "../../../src/settings/enums/Layout";
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
    cy.all([
        cy.window({ log: false }),
        cy.getClient(),
    ]).then(([win, cli]) => {
        const size = AVATAR_SIZE * win.devicePixelRatio;
        expect(e.find(".mx_BaseAvatar_image").attr("src")).to.equal(
            // eslint-disable-next-line no-restricted-properties
            cli.mxcUrlToHttp(avatarUrl, size, size, AVATAR_RESIZE_METHOD),
        );
    });
};

const sendEvent = (roomId: string, html = false): Chainable<ISendEventResponse> => {
    return cy.sendEvent(
        roomId,
        null,
        "m.room.message" as EventType,
        MessageEvent.from("Message", html ? "<b>Message</b>" : undefined).serialize().content,
    );
};

describe("Timeline", () => {
    let synapse: SynapseInstance;

    let roomId: string;

    let oldAvatarUrl: string;
    let newAvatarUrl: string;

    beforeEach(() => {
        cy.startSynapse("default").then(data => {
            synapse = data;
            cy.initTestUser(synapse, OLD_NAME).then(() =>
                cy.createRoom({ name: ROOM_NAME }).then(_room1Id => {
                    roomId = _room1Id;
                }),
            );
        });
    });

    afterEach(() => {
        cy.stopSynapse(synapse);
    });

    describe("useOnlyCurrentProfiles", () => {
        beforeEach(() => {
            cy.uploadContent(OLD_AVATAR).then((url) => {
                oldAvatarUrl = url;
                cy.setAvatarUrl(url);
            });
            cy.uploadContent(NEW_AVATAR).then((url) => {
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
            cy.contains(".mx_RoomView_body .mx_GenericEventListSummary[data-layout=irc] " +
                ".mx_GenericEventListSummary_summary", "created and configured the room.").should("exist");
            cy.get(".mx_Spinner").should("not.exist");
            cy.percySnapshot("Configured room on IRC layout");
        });

        it("should add inline start margin to an event line on IRC layout", () => {
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);

            // Wait until configuration is finished
            cy.contains(".mx_RoomView_body .mx_GenericEventListSummary " +
                ".mx_GenericEventListSummary_summary", "created and configured the room.").should("exist");

            // Click "expand" link button
            cy.get(".mx_GenericEventListSummary_toggle[aria-expanded=false]").click();

            // Check the event line has margin instead of inset property
            // cf. _EventTile.pcss
            //  --EventTile_irc_line_info-margin-inline-start
            //  = calc(var(--name-width) + 10px + var(--icon-width))
            //  = 80 + 10 + 14 = 104px
            cy.get(".mx_EventTile[data-layout=irc].mx_EventTile_info:first-of-type .mx_EventTile_line")
                .should('have.css', "margin-inline-start", "104px")
                .should('have.css', "inset-inline-start", "0px");

            cy.get(".mx_Spinner").should("not.exist");
            // Exclude timestamp from snapshot
            const percyCSS = ".mx_RoomView_body .mx_EventTile_info .mx_MessageTimestamp "
                + "{ visibility: hidden !important; }";
            cy.percySnapshot("Event line with inline start margin on IRC layout", { percyCSS });
            cy.checkA11y();
        });

        it("should set inline start padding to a hidden event line", () => {
            sendEvent(roomId);
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);
            cy.contains(".mx_RoomView_body .mx_GenericEventListSummary .mx_GenericEventListSummary_summary",
                "created and configured the room.").should("exist");

            // Edit message
            cy.contains(".mx_RoomView_body .mx_EventTile .mx_EventTile_line", "Message").within(() => {
                cy.get('[aria-label="Edit"]').click({ force: true }); // Cypress has no ability to hover
                cy.get(".mx_BasicMessageComposer_input").type("Edit{enter}");
            });
            cy.contains(".mx_EventTile[data-scroll-tokens]", "MessageEdit").should("exist");

            // Click timestamp to highlight hidden event line
            cy.get(".mx_RoomView_body .mx_EventTile_info .mx_MessageTimestamp").click();

            // Exclude timestamp from snapshot
            const percyCSS = ".mx_RoomView_body .mx_EventTile .mx_MessageTimestamp "
                + "{ visibility: hidden !important; }";

            // should not add inline start padding to a hidden event line on IRC layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.IRC);
            cy.get(".mx_EventTile[data-layout=irc].mx_EventTile_info .mx_EventTile_line")
                .should('have.css', 'padding-inline-start', '0px');
            cy.percySnapshot("Hidden event line with zero padding on IRC layout", { percyCSS });

            // should add inline start padding to a hidden event line on modern layout
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Group);
            cy.get(".mx_EventTile[data-layout=group].mx_EventTile_info .mx_EventTile_line")
                // calc(var(--EventTile_group_line-spacing-inline-start) + 20px) = 64 + 20 = 84px
                .should('have.css', 'padding-inline-start', '84px');
            cy.percySnapshot("Hidden event line with padding on modern layout", { percyCSS });
        });

        it("should click top left of view source event toggle", () => {
            sendEvent(roomId);
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("showHiddenEventsInTimeline", null, SettingLevel.DEVICE, true);
            cy.contains(".mx_RoomView_body .mx_GenericEventListSummary " +
                ".mx_GenericEventListSummary_summary", "created and configured the room.").should("exist");

            // Edit message
            cy.contains(".mx_RoomView_body .mx_EventTile .mx_EventTile_line", "Message").within(() => {
                cy.get('[aria-label="Edit"]').click({ force: true }); // Cypress has no ability to hover
                cy.get(".mx_BasicMessageComposer_input").type("Edit{enter}");
            });
            cy.contains(".mx_RoomView_body .mx_EventTile[data-scroll-tokens]", "MessageEdit").should("exist");

            // Click top left of the event toggle, which should not be covered by MessageActionBar's safe area
            cy.get(".mx_EventTile .mx_ViewSourceEvent").should("exist").realHover().within(() => {
                cy.get(".mx_ViewSourceEvent_toggle").click('topLeft', { force: false });
            });

            // Make sure the expand toggle worked
            cy.get(".mx_EventTile .mx_ViewSourceEvent_expanded .mx_ViewSourceEvent_toggle").should("be.visible");
        });

        it("should click 'collapse' link button on the first hovered info event line on bubble layout", () => {
            cy.visit("/#/room/" + roomId);
            cy.setSettingValue("layout", null, SettingLevel.DEVICE, Layout.Bubble);
            cy.contains(".mx_RoomView_body .mx_GenericEventListSummary[data-layout=bubble] " +
                ".mx_GenericEventListSummary_summary", "created and configured the room.").should("exist");

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

            cy.get(".mx_EventTile:not(.mx_EventTile_contextual)").find(".mx_EventTile_searchHighlight").should("exist");
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

            cy.sendEvent(
                roomId,
                null,
                "m.room.message" as EventType,
                MessageEvent.from("https://call.element.io/").serialize().content,
            );
            cy.visit("/#/room/" + roomId);

            cy.get(".mx_LinkPreviewWidget").should("exist").should("contain.text", "Element Call");

            cy.wait("@preview_url");
            cy.wait("@mxc");

            cy.checkA11y();
            cy.get(".mx_EventTile_last").percySnapshotElement("URL Preview", {
                widths: [800, 400],
            });
        });
    });

    describe("message sending", () => {
        const MESSAGE = "Hello world";
        const viewRoomSendMessageAndSetupReply = () => {
            // View room
            cy.visit("/#/room/" + roomId);

            // Send a message
            cy.getComposer().type(`${MESSAGE}{enter}`);

            // Reply to the message
            cy.get(".mx_RoomView_body").contains(".mx_EventTile_line", "Hello world").within(() => {
                cy.get('[aria-label="Reply"]').click({ force: true }); // Cypress has no ability to hover
            });
        };

        it("can reply with a text message", () => {
            const reply = "Reply";
            viewRoomSendMessageAndSetupReply();

            cy.getComposer().type(`${reply}{enter}`);

            cy.get(".mx_RoomView_body .mx_EventTile .mx_EventTile_line .mx_ReplyTile .mx_MTextBody")
                .should("contain", MESSAGE);
            cy.contains(".mx_RoomView_body .mx_EventTile > .mx_EventTile_line > .mx_MTextBody", reply)
                .should("have.length", 1);
        });

        it("can reply with a voice message", () => {
            viewRoomSendMessageAndSetupReply();

            cy.openMessageComposerOptions().within(() => {
                cy.get(`[aria-label="Voice Message"]`).click();
            });
            cy.wait(3000);
            cy.get(".mx_RoomView_body .mx_MessageComposer .mx_MessageComposer_sendMessage").click();

            cy.get(".mx_RoomView_body .mx_EventTile .mx_EventTile_line .mx_ReplyTile .mx_MTextBody")
                .should("contain", MESSAGE);
            cy.get(".mx_RoomView_body .mx_EventTile > .mx_EventTile_line > .mx_MVoiceMessageBody")
                .should("have.length", 1);
        });
    });
});
