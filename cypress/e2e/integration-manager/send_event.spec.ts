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
import { UserCredentials } from "../../support/login";

const ROOM_NAME = "Integration Manager Test";
const USER_DISPLAY_NAME = "Alice";

const INTEGRATION_MANAGER_TOKEN = "DefinitelySecret_DoNotUseThisForReal";
const INTEGRATION_MANAGER_HTML = `
    <html lang="en">
        <head>
            <title>Fake Integration Manager</title>
        </head>
        <body>
            <input type="text" id="target-room-id"/>
            <input type="text" id="event-type"/>
            <input type="text" id="state-key"/>
            <input type="text" id="event-content"/>
            <button name="Send" id="send-action">Press to send action</button>
            <button name="Close" id="close">Press to close</button>
            <p id="message-response">No response</p>
            <script>
                document.getElementById("send-action").onclick = () => {
                    window.parent.postMessage(
                        {
                            action: "send_event",
                            room_id: document.getElementById("target-room-id").value,
                            type: document.getElementById("event-type").value,
                            state_key: document.getElementById("state-key").value,
                            content: JSON.parse(document.getElementById("event-content").value),
                        },
                        '*',
                    );
                };
                document.getElementById("close").onclick = () => {
                    window.parent.postMessage(
                        {
                            action: "close_scalar",
                        },
                        '*',
                    );
                };
                // Listen for a postmessage response
                window.addEventListener("message", (event) => {
                    document.getElementById("message-response").innerText = JSON.stringify(event.data);
                });
            </script>
        </body>
    </html>
`;

function openIntegrationManager() {
    cy.findByRole("button", { name: "Room info" }).click();
    cy.get(".mx_RoomSummaryCard_appsGroup").within(() => {
        cy.findByRole("button", { name: "Add widgets, bridges & bots" }).click();
    });
}

function sendActionFromIntegrationManager(
    integrationManagerUrl: string,
    targetRoomId: string,
    eventType: string,
    stateKey: string,
    content: Record<string, unknown>,
) {
    cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
        cy.get("#target-room-id").should("exist").type(targetRoomId);
        cy.get("#event-type").should("exist").type(eventType);
        if (stateKey) {
            cy.get("#state-key").should("exist").type(stateKey);
        }
        cy.get("#event-content").should("exist").type(JSON.stringify(content), { parseSpecialCharSequences: false });
        cy.get("#send-action").should("exist").click();
    });
}

describe("Integration Manager: Send Event", () => {
    let testUser: UserCredentials;
    let homeserver: HomeserverInstance;
    let integrationManagerUrl: string;

    beforeEach(() => {
        cy.serveHtmlFile(INTEGRATION_MANAGER_HTML).then((url) => {
            integrationManagerUrl = url;
        });
        cy.startHomeserver("default").then((data) => {
            homeserver = data;

            cy.initTestUser(homeserver, USER_DISPLAY_NAME, () => {
                cy.window().then((win) => {
                    win.localStorage.setItem("mx_scalar_token", INTEGRATION_MANAGER_TOKEN);
                    win.localStorage.setItem(`mx_scalar_token_at_${integrationManagerUrl}`, INTEGRATION_MANAGER_TOKEN);
                });
            }).then((user) => {
                testUser = user;
            });

            cy.setAccountData("m.widgets", {
                "m.integration_manager": {
                    content: {
                        type: "m.integration_manager",
                        name: "Integration Manager",
                        url: integrationManagerUrl,
                        data: {
                            api_url: integrationManagerUrl,
                        },
                    },
                    id: "integration-manager",
                },
            }).as("integrationManager");

            // Succeed when checking the token is valid
            cy.intercept(`${integrationManagerUrl}/account?scalar_token=${INTEGRATION_MANAGER_TOKEN}*`, (req) => {
                req.continue((res) => {
                    return res.send(200, {
                        user_id: testUser.userId,
                    });
                });
            });

            cy.createRoom({
                name: ROOM_NAME,
            }).as("roomId");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
        cy.stopWebServers();
    });

    it("should send a state event", () => {
        cy.all([cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(([roomId]) => {
            cy.viewRoomByName(ROOM_NAME);

            openIntegrationManager();

            const eventType = "io.element.integrations.installations";
            const eventContent = {
                foo: "bar",
            };
            const stateKey = "state-key-123";

            // Send the event
            sendActionFromIntegrationManager(integrationManagerUrl, roomId, eventType, stateKey, eventContent);

            // Check the response
            cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
                cy.get("#message-response").should("include.text", "event_id");
            });

            // Check the event
            cy.getClient()
                .then(async (client) => {
                    return await client.getStateEvent(roomId, eventType, stateKey);
                })
                .then((event) => {
                    expect(event).to.deep.equal(eventContent);
                });
        });
    });

    it("should send a state event with empty content", () => {
        cy.all([cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(([roomId]) => {
            cy.viewRoomByName(ROOM_NAME);

            openIntegrationManager();

            const eventType = "io.element.integrations.installations";
            const eventContent = {};
            const stateKey = "state-key-123";

            // Send the event
            sendActionFromIntegrationManager(integrationManagerUrl, roomId, eventType, stateKey, eventContent);

            // Check the response
            cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
                cy.get("#message-response").should("include.text", "event_id");
            });

            // Check the event
            cy.getClient()
                .then(async (client) => {
                    return await client.getStateEvent(roomId, eventType, stateKey);
                })
                .then((event) => {
                    expect(event).to.be.empty;
                });
        });
    });

    it("should send a state event with empty state key", () => {
        cy.all([cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(([roomId]) => {
            cy.viewRoomByName(ROOM_NAME);

            openIntegrationManager();

            const eventType = "io.element.integrations.installations";
            const eventContent = {
                foo: "bar",
            };
            const stateKey = "";

            // Send the event
            sendActionFromIntegrationManager(integrationManagerUrl, roomId, eventType, stateKey, eventContent);

            // Check the response
            cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
                cy.get("#message-response").should("include.text", "event_id");
            });

            // Check the event
            cy.getClient()
                .then(async (client) => {
                    return await client.getStateEvent(roomId, eventType, stateKey);
                })
                .then((event) => {
                    expect(event).to.deep.equal(eventContent);
                });
        });
    });

    it("should fail to send an event type which is not allowed", () => {
        cy.all([cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(([roomId]) => {
            cy.viewRoomByName(ROOM_NAME);

            openIntegrationManager();

            const eventType = "com.example.event";
            const eventContent = {
                foo: "bar",
            };
            const stateKey = "";

            // Send the event
            sendActionFromIntegrationManager(integrationManagerUrl, roomId, eventType, stateKey, eventContent);

            // Check the response
            cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
                cy.get("#message-response").should("include.text", "Failed to send event");
            });
        });
    });
});
