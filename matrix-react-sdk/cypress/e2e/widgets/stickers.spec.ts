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

import { HomeserverInstance } from "../../plugins/utils/homeserver";

const STICKER_PICKER_WIDGET_ID = "fake-sticker-picker";
const STICKER_PICKER_WIDGET_NAME = "Fake Stickers";
const STICKER_NAME = "Test Sticker";
const ROOM_NAME_1 = "Sticker Test";
const ROOM_NAME_2 = "Sticker Test Two";
const STICKER_MESSAGE = JSON.stringify({
    action: "m.sticker",
    api: "fromWidget",
    data: {
        name: "teststicker",
        description: STICKER_NAME,
        file: "test.png",
        content: {
            body: STICKER_NAME,
            msgtype: "m.sticker",
            url: "mxc://somewhere",
        },
    },
    requestId: "1",
    widgetId: STICKER_PICKER_WIDGET_ID,
});
const WIDGET_HTML = `
    <html lang="en">
        <head>
            <title>Fake Sticker Picker</title>
            <script>
                window.onmessage = ev => {
                    if (ev.data.action === 'capabilities') {
                        window.parent.postMessage(Object.assign({
                            response: {
                                capabilities: ["m.sticker"]
                            },
                        }, ev.data), '*');
                    }
                };
            </script>
        </head>
        <body>
            <button name="Send" id="sendsticker">Press for sticker</button>
            <script>
                document.getElementById('sendsticker').onclick = () => {
                    window.parent.postMessage(${STICKER_MESSAGE}, '*')
                };
            </script>
        </body>
    </html>
`;

function openStickerPicker() {
    cy.openMessageComposerOptions().findByRole("menuitem", { name: "Sticker" }).click();
}

function sendStickerFromPicker() {
    // Note: Until https://github.com/cypress-io/cypress/issues/136 is fixed we will need
    // to use `chromeWebSecurity: false` in our cypress config. Not even cy.origin() can
    // break into the iframe for us :(
    cy.accessIframe(`iframe[title="${STICKER_PICKER_WIDGET_NAME}"]`).within({}, () => {
        cy.get("#sendsticker").should("exist").click();
    });

    // Sticker picker should close itself after sending.
    cy.get(".mx_AppTileFullWidth#stickers").should("not.exist");
}

function expectTimelineSticker(roomId: string) {
    // Make sure it's in the right room
    cy.get(".mx_EventTile_sticker > a").should("have.attr", "href").and("include", `/${roomId}/`);

    // Make sure the image points at the sticker image
    cy.get<HTMLImageElement>(`img[alt="${STICKER_NAME}"]`)
        .should("have.attr", "src")
        .and("match", /thumbnail\/somewhere\?/);
}

describe("Stickers", () => {
    // We spin up a web server for the sticker picker so that we're not testing to see if
    // sysadmins can deploy sticker pickers on the same Element domain - we actually want
    // to make sure that cross-origin postMessage works properly. This makes it difficult
    // to write the test though, as we have to juggle iframe logistics.
    //
    // See sendStickerFromPicker() for more detail on iframe comms.

    let stickerPickerUrl: string;
    let homeserver: HomeserverInstance;
    let userId: string;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Sally").then((user) => (userId = user.userId));
        });
        cy.serveHtmlFile(WIDGET_HTML).then((url) => {
            stickerPickerUrl = url;
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
        cy.stopWebServers();
    });

    it("should send a sticker to multiple rooms", () => {
        cy.createRoom({
            name: ROOM_NAME_1,
        }).as("roomId1");
        cy.createRoom({
            name: ROOM_NAME_2,
        }).as("roomId2");
        cy.setAccountData("m.widgets", {
            [STICKER_PICKER_WIDGET_ID]: {
                content: {
                    type: "m.stickerpicker",
                    name: STICKER_PICKER_WIDGET_NAME,
                    url: stickerPickerUrl,
                    creatorUserId: userId,
                },
                sender: userId,
                state_key: STICKER_PICKER_WIDGET_ID,
                type: "m.widget",
                id: STICKER_PICKER_WIDGET_ID,
            },
        }).as("stickers");

        cy.all([
            cy.get<string>("@roomId1"),
            cy.get<string>("@roomId2"),
            cy.get<{}>("@stickers"), // just want to wait for it to be set up
        ]).then(([roomId1, roomId2]) => {
            cy.viewRoomByName(ROOM_NAME_1);
            cy.url().should("contain", `/#/room/${roomId1}`);
            openStickerPicker();
            sendStickerFromPicker();
            expectTimelineSticker(roomId1);

            // Ensure that when we switch to a different room that the sticker
            // goes to the right place
            cy.viewRoomByName(ROOM_NAME_2);
            cy.url().should("contain", `/#/room/${roomId2}`);
            openStickerPicker();
            sendStickerFromPicker();
            expectTimelineSticker(roomId2);
        });
    });

    it("should handle a sticker picker widget missing creatorUserId", () => {
        cy.createRoom({
            name: ROOM_NAME_1,
        }).as("roomId1");
        cy.setAccountData("m.widgets", {
            [STICKER_PICKER_WIDGET_ID]: {
                content: {
                    type: "m.stickerpicker",
                    name: STICKER_PICKER_WIDGET_NAME,
                    url: stickerPickerUrl,
                    // No creatorUserId
                },
                sender: userId,
                state_key: STICKER_PICKER_WIDGET_ID,
                type: "m.widget",
                id: STICKER_PICKER_WIDGET_ID,
            },
        }).as("stickers");

        cy.all([cy.get<string>("@roomId1"), cy.get<{}>("@stickers")]).then(([roomId1]) => {
            cy.viewRoomByName(ROOM_NAME_1);
            cy.url().should("contain", `/#/room/${roomId1}`);
            openStickerPicker();
            sendStickerFromPicker();
            expectTimelineSticker(roomId1);
        });
    });
});
