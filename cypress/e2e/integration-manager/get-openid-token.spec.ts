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
            <button name="Send" id="send-action">Press to send action</button>
            <button name="Close" id="close">Press to close</button>
            <p id="message-response">No response</p>
            <script>
                document.getElementById("send-action").onclick = () => {
                    window.parent.postMessage(
                        {
                            action: "get_open_id_token",
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
    cy.findByRole("button", { name: "Add widgets, bridges & bots" }).click();
}

function sendActionFromIntegrationManager(integrationManagerUrl: string) {
    cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
        cy.findByRole("button", { name: "Press to send action" }).should("exist").click();
    });
}

describe("Integration Manager: Get OpenID Token", () => {
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

    it("should successfully obtain an openID token", () => {
        cy.all([cy.get<{}>("@integrationManager")]).then(() => {
            cy.viewRoomByName(ROOM_NAME);

            openIntegrationManager();
            sendActionFromIntegrationManager(integrationManagerUrl);

            cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
                cy.get("#message-response").within(() => {
                    cy.findByText(/access_token/);
                });
            });
        });
    });
});
