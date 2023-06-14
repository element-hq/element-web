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

import type { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
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
                let sendEventCount = 0
                window.onmessage = ev => {
                    if (ev.data.action === 'capabilities') {
                        window.parent.postMessage(Object.assign({
                            response: {
                                capabilities: [
                                    "org.matrix.msc2762.timeline:*",
                                    "org.matrix.msc2762.receive.state_event:m.room.topic",
                                    "org.matrix.msc2762.send.event:net.widget_echo"
                                ]
                            },
                        }, ev.data), '*');
                    } else if (ev.data.action === 'send_event' && !ev.data.response) {
                        // wraps received event into 'net.widget_echo' and sends back
                        sendEventCount += 1
                        window.parent.postMessage({
                            api: "fromWidget",
                            widgetId: ev.data.widgetId,
                            requestId: 'widget-' + sendEventCount,
                            action: "send_event",
                            data: {
                                type: 'net.widget_echo',
                                content: ev.data.data // sets matrix event to the content returned
                            },
                        }, '*')
                    }
                };
            </script>
        </head>
        <body>
            <button id="demo">Demo</button>
        </body>
    </html>
`;

function waitForRoom(win: Cypress.AUTWindow, roomId: string, predicate: (room: Room) => boolean): Promise<void> {
    const matrixClient = win.mxMatrixClientPeg.get();

    return new Promise((resolve, reject) => {
        const room = matrixClient.getRoom(roomId);

        if (predicate(room)) {
            resolve();
            return;
        }

        function onEvent(ev: MatrixEvent) {
            if (ev.getRoomId() !== roomId) return;

            if (predicate(room)) {
                matrixClient.removeListener(win.matrixcs.ClientEvent.Event, onEvent);
                resolve();
            }
        }

        matrixClient.on(win.matrixcs.ClientEvent.Event, onEvent);
    });
}

describe("Widget Events", () => {
    let homeserver: HomeserverInstance;
    let user: UserCredentials;
    let bot: MatrixClient;
    let demoWidgetUrl: string;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Mike").then((_user) => {
                user = _user;
            });
            cy.getBot(homeserver, { displayName: "Bot", autoAcceptInvites: true }).then((_bot) => {
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

    it("should be updated if user is re-invited into the room with updated state event", () => {
        cy.createRoom({
            name: ROOM_NAME,
            invite: [bot.getUserId()],
        }).then((roomId) => {
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

            // set initial layout
            cy.getClient()
                .then(async (matrixClient) => {
                    const content = {
                        widgets: {
                            [DEMO_WIDGET_ID]: {
                                container: "top",
                                index: 1,
                                width: 100,
                                height: 0,
                            },
                        },
                    };
                    await matrixClient.sendStateEvent(roomId, "io.element.widgets.layout", content, "");
                })
                .as("layoutEventSent");

            // open the room
            cy.viewRoomByName(ROOM_NAME);

            // approve capabilities
            cy.get(".mx_WidgetCapabilitiesPromptDialog").within(() => {
                cy.findByRole("button", { name: "Approve" }).click();
            });

            cy.all([cy.get<string>("@widgetEventSent"), cy.get<string>("@layoutEventSent")]).then(async () => {
                // bot creates a new room with 'm.room.topic'
                const { room_id: roomNew } = await bot.createRoom({
                    name: "New room",
                    initial_state: [
                        {
                            type: "m.room.topic",
                            state_key: "",
                            content: {
                                topic: "topic initial",
                            },
                        },
                    ],
                });

                await bot.invite(roomNew, user.userId);

                // widget should receive 'm.room.topic' event after invite
                cy.window().then(async (win) => {
                    await waitForRoom(win, roomId, (room) => {
                        const events = room.getLiveTimeline().getEvents();
                        return events.some(
                            (e) =>
                                e.getType() === "net.widget_echo" &&
                                e.getContent().type === "m.room.topic" &&
                                e.getContent().content.topic === "topic initial",
                        );
                    });
                });

                // update the topic
                await bot.sendStateEvent(
                    roomNew,
                    "m.room.topic",
                    {
                        topic: "topic updated",
                    },
                    "",
                );

                await bot.invite(roomNew, user.userId, "something changed in the room");

                // widget should receive updated 'm.room.topic' event after re-invite
                cy.window().then(async (win) => {
                    await waitForRoom(win, roomId, (room) => {
                        const events = room.getLiveTimeline().getEvents();
                        return events.some(
                            (e) =>
                                e.getType() === "net.widget_echo" &&
                                e.getContent().type === "m.room.topic" &&
                                e.getContent().content.topic === "topic updated",
                        );
                    });
                });
            });
        });
    });
});
