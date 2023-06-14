/*
Copyright 2022 Mikhail Aheichyk
Copyright 2022 Nordeck IT + Consulting GmbH.

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

import { IWidget } from "matrix-widget-api/src/interfaces/IWidget";

import type { MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { HomeserverInstance } from "../../plugins/utils/homeserver";
import { UserCredentials } from "../../support/login";

const DEMO_WIDGET_ID = "demo-widget-id";
const DEMO_WIDGET_NAME = "Demo Widget";
const DEMO_WIDGET_TYPE = "demo";
const ROOM_NAME = "Demo";

const DEMO_WIDGET_HTML = `
    <html lang="en">
        <head>
            <title>Demo Widget</title>
            <script>
                window.onmessage = ev => {
                    if (ev.data.action === 'capabilities') {
                        window.parent.postMessage(Object.assign({
                            response: {
                                capabilities: []
                            },
                        }, ev.data), '*');
                    }
                };
            </script>
        </head>
        <body>
            <button id="demo">Demo</button>
        </body>
    </html>
`;

// mostly copied from src/utils/WidgetUtils.waitForRoomWidget with small modifications
function waitForRoomWidget(win: Cypress.AUTWindow, widgetId: string, roomId: string, add: boolean): Promise<void> {
    const matrixClient = win.mxMatrixClientPeg.get();

    return new Promise((resolve, reject) => {
        function eventsInIntendedState(evList) {
            const widgetPresent = evList.some((ev) => {
                return ev.getContent() && ev.getContent()["id"] === widgetId;
            });
            if (add) {
                return widgetPresent;
            } else {
                return !widgetPresent;
            }
        }

        const room = matrixClient.getRoom(roomId);

        const startingWidgetEvents = room.currentState.getStateEvents("im.vector.modular.widgets");
        if (eventsInIntendedState(startingWidgetEvents)) {
            resolve();
            return;
        }

        function onRoomStateEvents(ev: MatrixEvent) {
            if (ev.getRoomId() !== roomId || ev.getType() !== "im.vector.modular.widgets") return;

            const currentWidgetEvents = room.currentState.getStateEvents("im.vector.modular.widgets");

            if (eventsInIntendedState(currentWidgetEvents)) {
                matrixClient.removeListener(win.matrixcs.RoomStateEvent.Events, onRoomStateEvents);
                resolve();
            }
        }

        matrixClient.on(win.matrixcs.RoomStateEvent.Events, onRoomStateEvents);
    });
}

describe("Widget PIP", () => {
    let homeserver: HomeserverInstance;
    let user: UserCredentials;
    let bot: MatrixClient;
    let demoWidgetUrl: string;

    function roomCreateAddWidgetPip(userRemove: "leave" | "kick" | "ban") {
        cy.createRoom({
            name: ROOM_NAME,
            invite: [bot.getUserId()],
        }).then((roomId) => {
            // sets bot to Admin and user to Moderator
            cy.getClient()
                .then((matrixClient) => {
                    return matrixClient.sendStateEvent(roomId, "m.room.power_levels", {
                        users: {
                            [user.userId]: 50,
                            [bot.getUserId()]: 100,
                        },
                    });
                })
                .as("powerLevelsChanged");

            // bot joins the room
            cy.botJoinRoom(bot, roomId).as("botJoined");

            // setup widget via state event
            cy.getClient()
                .then(async (matrixClient) => {
                    const content: IWidget = {
                        id: DEMO_WIDGET_ID,
                        creatorUserId: "somebody",
                        type: DEMO_WIDGET_TYPE,
                        name: DEMO_WIDGET_NAME,
                        url: demoWidgetUrl,
                    };
                    await matrixClient.sendStateEvent(roomId, "im.vector.modular.widgets", content, DEMO_WIDGET_ID);
                })
                .as("widgetEventSent");

            // open the room
            cy.viewRoomByName(ROOM_NAME);

            cy.all([
                cy.get<string>("@powerLevelsChanged"),
                cy.get<string>("@botJoined"),
                cy.get<string>("@widgetEventSent"),
            ]).then(() => {
                cy.window().then(async (win) => {
                    // wait for widget state event
                    await waitForRoomWidget(win, DEMO_WIDGET_ID, roomId, true);

                    // activate widget in pip mode
                    win.mxActiveWidgetStore.setWidgetPersistence(DEMO_WIDGET_ID, roomId, true);

                    // checks that pip window is opened
                    cy.get(".mx_WidgetPip").should("exist");

                    // checks that widget is opened in pip
                    cy.accessIframe(`iframe[title="${DEMO_WIDGET_NAME}"]`).within({}, () => {
                        cy.get("#demo")
                            .should("exist")
                            .then(async () => {
                                const userId = user.userId;
                                if (userRemove == "leave") {
                                    cy.getClient().then(async (matrixClient) => {
                                        await matrixClient.leave(roomId);
                                    });
                                } else if (userRemove == "kick") {
                                    await bot.kick(roomId, userId);
                                } else if (userRemove == "ban") {
                                    await bot.ban(roomId, userId);
                                }

                                // checks that pip window is closed
                                cy.get(".mx_WidgetPip").should("not.exist");
                            });
                    });
                });
            });
        });
    }

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Mike").then((_user) => {
                user = _user;
            });
            cy.getBot(homeserver, { displayName: "Bot", autoAcceptInvites: false }).then((_bot) => {
                bot = _bot;
            });
        });
        cy.serveHtmlFile(DEMO_WIDGET_HTML).then((url) => {
            demoWidgetUrl = url;
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
        cy.stopWebServers();
    });

    it("should be closed on leave", () => {
        roomCreateAddWidgetPip("leave");
    });

    it("should be closed on kick", () => {
        roomCreateAddWidgetPip("kick");
    });

    it("should be closed on ban", () => {
        roomCreateAddWidgetPip("ban");
    });
});
