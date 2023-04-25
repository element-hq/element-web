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
import { MatrixClient } from "../../global";
import { UserCredentials } from "../../support/login";

const ROOM_NAME = "Integration Manager Test";
const USER_DISPLAY_NAME = "Alice";
const BOT_DISPLAY_NAME = "Bob";
const KICK_REASON = "Goodbye";

const INTEGRATION_MANAGER_TOKEN = "DefinitelySecret_DoNotUseThisForReal";
const INTEGRATION_MANAGER_HTML = `
    <html lang="en">
        <head>
            <title>Fake Integration Manager</title>
        </head>
        <body>
            <input type="text" id="target-room-id"/>
            <input type="text" id="target-user-id"/>
            <button name="Send" id="send-action">Press to send action</button>
            <button name="Close" id="close">Press to close</button>
            <script>
                document.getElementById("send-action").onclick = () => {
                    window.parent.postMessage(
                        {
                            action: "kick",
                            room_id: document.getElementById("target-room-id").value,
                            user_id: document.getElementById("target-user-id").value,
                            reason: "${KICK_REASON}",
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
            </script>
        </body>
    </html>
`;

function openIntegrationManager() {
    cy.findByRole("button", { name: "Room info" }).click();
    cy.findByRole("button", { name: "Add widgets, bridges & bots" }).click();
}

function closeIntegrationManager(integrationManagerUrl: string) {
    cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
        cy.findByRole("button", { name: "Press to close" }).should("exist").click();
    });
}

function sendActionFromIntegrationManager(integrationManagerUrl: string, targetRoomId: string, targetUserId: string) {
    cy.accessIframe(`iframe[src*="${integrationManagerUrl}"]`).within(() => {
        cy.get("#target-room-id").should("exist").type(targetRoomId);
        cy.get("#target-user-id").should("exist").type(targetUserId);
        cy.findByRole("button", { name: "Press to send action" }).should("exist").click();
    });
}

function clickUntilGone(selector: string, attempt = 0) {
    if (attempt === 11) {
        throw new Error("clickUntilGone attempt count exceeded");
    }

    cy.get(selector)
        .last()
        .click()
        .then(($button) => {
            const exists = Cypress.$(selector).length > 0;
            if (exists) {
                clickUntilGone(selector, ++attempt);
            }
        });
}

function expectKickedMessage(shouldExist: boolean) {
    // Expand any event summaries, we can't use a click multiple here because clicking one might de-render others
    // This is quite horrible but seems the most stable way of clicking 0-N buttons,
    // one at a time with a full re-evaluation after each click
    clickUntilGone(".mx_GenericEventListSummary_toggle[aria-expanded=false]");

    // Check for the event message (or lack thereof)
    cy.findByText(`${USER_DISPLAY_NAME} removed ${BOT_DISPLAY_NAME}: ${KICK_REASON}`).should(
        shouldExist ? "exist" : "not.exist",
    );
}

describe("Integration Manager: Kick", () => {
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

            cy.getBot(homeserver, { displayName: BOT_DISPLAY_NAME, autoAcceptInvites: true }).as("bob");
        });
    });

    afterEach(() => {
        cy.stopHomeserver(homeserver);
        cy.stopWebServers();
    });

    it("should kick the target", () => {
        cy.all([cy.get<MatrixClient>("@bob"), cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(
            ([targetUser, roomId]) => {
                const targetUserId = targetUser.getUserId();
                cy.viewRoomByName(ROOM_NAME);
                cy.inviteUser(roomId, targetUserId);
                cy.findByText(`${BOT_DISPLAY_NAME} joined the room`).should("exist");

                openIntegrationManager();
                sendActionFromIntegrationManager(integrationManagerUrl, roomId, targetUserId);
                closeIntegrationManager(integrationManagerUrl);
                expectKickedMessage(true);
            },
        );
    });

    it("should not kick the target if lacking permissions", () => {
        cy.all([cy.get<MatrixClient>("@bob"), cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(
            ([targetUser, roomId]) => {
                const targetUserId = targetUser.getUserId();
                cy.viewRoomByName(ROOM_NAME);
                cy.inviteUser(roomId, targetUserId);
                cy.findByText(`${BOT_DISPLAY_NAME} joined the room`).should("exist");
                cy.getClient()
                    .then(async (client) => {
                        await client.sendStateEvent(roomId, "m.room.power_levels", {
                            kick: 50,
                            users: {
                                [testUser.userId]: 0,
                            },
                        });
                    })
                    .then(() => {
                        openIntegrationManager();
                        sendActionFromIntegrationManager(integrationManagerUrl, roomId, targetUserId);
                        closeIntegrationManager(integrationManagerUrl);
                        expectKickedMessage(false);
                    });
            },
        );
    });

    it("should no-op if the target already left", () => {
        cy.all([cy.get<MatrixClient>("@bob"), cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(
            ([targetUser, roomId]) => {
                const targetUserId = targetUser.getUserId();
                cy.viewRoomByName(ROOM_NAME);
                cy.inviteUser(roomId, targetUserId);
                cy.findByText(`${BOT_DISPLAY_NAME} joined the room`)
                    .should("exist")
                    .then(async () => {
                        await targetUser.leave(roomId);
                    })
                    .then(() => {
                        openIntegrationManager();
                        sendActionFromIntegrationManager(integrationManagerUrl, roomId, targetUserId);
                        closeIntegrationManager(integrationManagerUrl);
                        expectKickedMessage(false);
                    });
            },
        );
    });

    it("should no-op if the target was banned", () => {
        cy.all([cy.get<MatrixClient>("@bob"), cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(
            ([targetUser, roomId]) => {
                const targetUserId = targetUser.getUserId();
                cy.viewRoomByName(ROOM_NAME);
                cy.inviteUser(roomId, targetUserId);
                cy.findByText(`${BOT_DISPLAY_NAME} joined the room`).should("exist");
                cy.getClient()
                    .then(async (client) => {
                        await client.ban(roomId, targetUserId);
                    })
                    .then(() => {
                        openIntegrationManager();
                        sendActionFromIntegrationManager(integrationManagerUrl, roomId, targetUserId);
                        closeIntegrationManager(integrationManagerUrl);
                        expectKickedMessage(false);
                    });
            },
        );
    });

    it("should no-op if the target was never a room member", () => {
        cy.all([cy.get<MatrixClient>("@bob"), cy.get<string>("@roomId"), cy.get<{}>("@integrationManager")]).then(
            ([targetUser, roomId]) => {
                const targetUserId = targetUser.getUserId();
                cy.viewRoomByName(ROOM_NAME);

                openIntegrationManager();
                sendActionFromIntegrationManager(integrationManagerUrl, roomId, targetUserId);
                closeIntegrationManager(integrationManagerUrl);
                expectKickedMessage(false);
            },
        );
    });
});
