/*
Copyright 2022 Oliver Sand
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

import { IWidget } from "matrix-widget-api";

import { HomeserverInstance } from "../../plugins/utils/homeserver";

const ROOM_NAME = "Test Room";
const WIDGET_ID = "fake-widget";
const WIDGET_HTML = `
    <html lang="en">
        <head>
            <title>Fake Widget</title>
        </head>
        <body>
            Hello World
        </body>
    </html>
`;

describe("Widget Layout", () => {
    let widgetUrl: string;
    let homeserver: HomeserverInstance;
    let roomId: string;

    beforeEach(() => {
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, "Sally");
        });
        cy.serveHtmlFile(WIDGET_HTML).then((url) => {
            widgetUrl = url;
        });

        cy.createRoom({
            name: ROOM_NAME,
        }).then((id) => {
            roomId = id;

            // setup widget via state event
            cy.getClient()
                .then(async (matrixClient) => {
                    const content: IWidget = {
                        id: WIDGET_ID,
                        creatorUserId: "somebody",
                        type: "widget",
                        name: "widget",
                        url: widgetUrl,
                    };
                    await matrixClient.sendStateEvent(roomId, "im.vector.modular.widgets", content, WIDGET_ID);
                })
                .as("widgetEventSent");

            // set initial layout
            cy.getClient()
                .then(async (matrixClient) => {
                    const content = {
                        widgets: {
                            [WIDGET_ID]: {
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
        });

        cy.all([cy.get<string>("@widgetEventSent"), cy.get<string>("@layoutEventSent")]).then(() => {
            // open the room
            cy.viewRoomByName(ROOM_NAME);
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
        cy.stopWebServers();
    });

    it("should be set properly", () => {
        cy.get(".mx_AppsDrawer").percySnapshotElement("Widgets drawer on the timeline (AppsDrawer)");
    });

    it("manually resize the height of the top container layout", () => {
        cy.get('iframe[title="widget"]').invoke("height").should("be.lessThan", 250);

        cy.get(".mx_AppsContainer_resizerHandle")
            .trigger("mousedown")
            .trigger("mousemove", { clientX: 0, clientY: 550, force: true })
            .trigger("mouseup", { clientX: 0, clientY: 550, force: true });

        cy.get('iframe[title="widget"]').invoke("height").should("be.greaterThan", 400);
    });

    it("programatically resize the height of the top container layout", () => {
        cy.get('iframe[title="widget"]').invoke("height").should("be.lessThan", 250);

        cy.getClient().then(async (matrixClient) => {
            const content = {
                widgets: {
                    [WIDGET_ID]: {
                        container: "top",
                        index: 1,
                        width: 100,
                        height: 100,
                    },
                },
            };
            await matrixClient.sendStateEvent(roomId, "io.element.widgets.layout", content, "");
        });

        cy.get('iframe[title="widget"]').invoke("height").should("be.greaterThan", 400);
    });
});
