/*
Copyright 2024 New Vector Ltd.
Copyright 2022, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Page } from "@playwright/test";
import { test, expect } from "../../element-web-test";
import { openIntegrationManager } from "./utils";
import type { UserWidget } from "../../../src/utils/WidgetUtils-types.ts";

const ROOM_NAME = "Integration Manager Test";

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

async function sendActionFromIntegrationManager(
    page: Page,
    integrationManagerUrl: string,
    targetRoomId: string,
    eventType: string,
    stateKey: string,
    content: Record<string, unknown>,
) {
    const iframe = page.frameLocator(`iframe[src*="${integrationManagerUrl}"]`);
    await iframe.locator("#target-room-id").fill(targetRoomId);
    await iframe.locator("#event-type").fill(eventType);
    if (stateKey) {
        await iframe.locator("#state-key").fill(stateKey);
    }
    await iframe.locator("#event-content").fill(JSON.stringify(content));
    await iframe.locator("#send-action").click();
}

test.describe("Integration Manager: Send Event", () => {
    test.use({
        displayName: "Alice",
        room: async ({ user, app }, use) => {
            const roomId = await app.client.createRoom({
                name: ROOM_NAME,
            });
            await use({ roomId });
        },
    });

    let integrationManagerUrl: string;
    test.beforeEach(async ({ page, webserver }) => {
        integrationManagerUrl = webserver.start(INTEGRATION_MANAGER_HTML);

        await page.addInitScript(
            ({ token, integrationManagerUrl }) => {
                window.localStorage.setItem("mx_scalar_token", token);
                window.localStorage.setItem(`mx_scalar_token_at_${integrationManagerUrl}`, token);
            },
            {
                token: INTEGRATION_MANAGER_TOKEN,
                integrationManagerUrl,
            },
        );
    });

    test.beforeEach(async ({ page, user, app, room }) => {
        await app.client.setAccountData("m.widgets", {
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
            } as unknown as UserWidget,
        });

        // Succeed when checking the token is valid
        await page.route(
            `${integrationManagerUrl}/account?scalar_token=${INTEGRATION_MANAGER_TOKEN}*`,
            async (route) => {
                await route.fulfill({
                    json: {
                        user_id: user.userId,
                    },
                });
            },
        );

        await app.viewRoomByName(ROOM_NAME);
        await openIntegrationManager(app);
    });

    test("should send a state event", async ({ page, app, room }) => {
        const eventType = "io.element.integrations.installations";
        const eventContent = {
            foo: "bar",
        };
        const stateKey = "state-key-123";

        // Send the event
        await sendActionFromIntegrationManager(
            page,
            integrationManagerUrl,
            room.roomId,
            eventType,
            stateKey,
            eventContent,
        );

        // Check the response
        const iframe = page.frameLocator(`iframe[src*="${integrationManagerUrl}"]`);
        await expect(iframe.locator("#message-response")).toContainText("event_id");

        // Check the event
        const event = await app.client.evaluate(
            (cli, { room, eventType, stateKey }) => {
                return cli.getStateEvent(room.roomId, eventType, stateKey);
            },
            { room, eventType, stateKey },
        );
        expect(event).toMatchObject(eventContent);
    });

    test("should send a state event with empty content", async ({ page, app, room }) => {
        const eventType = "io.element.integrations.installations";
        const eventContent = {};
        const stateKey = "state-key-123";

        // Send the event
        await sendActionFromIntegrationManager(
            page,
            integrationManagerUrl,
            room.roomId,
            eventType,
            stateKey,
            eventContent,
        );

        // Check the response
        const iframe = page.frameLocator(`iframe[src*="${integrationManagerUrl}"]`);
        await expect(iframe.locator("#message-response")).toContainText("event_id");

        // Check the event
        const event = await app.client.evaluate(
            (cli, { room, eventType, stateKey }) => {
                return cli.getStateEvent(room.roomId, eventType, stateKey);
            },
            { room, eventType, stateKey },
        );
        expect(event).toMatchObject({});
    });

    test("should send a state event with empty state key", async ({ page, app, room }) => {
        const eventType = "io.element.integrations.installations";
        const eventContent = {
            foo: "bar",
        };
        const stateKey = "";

        // Send the event
        await sendActionFromIntegrationManager(
            page,
            integrationManagerUrl,
            room.roomId,
            eventType,
            stateKey,
            eventContent,
        );

        // Check the response
        const iframe = page.frameLocator(`iframe[src*="${integrationManagerUrl}"]`);
        await expect(iframe.locator("#message-response")).toContainText("event_id");

        // Check the event
        const event = await app.client.evaluate(
            (cli, { room, eventType, stateKey }) => {
                return cli.getStateEvent(room.roomId, eventType, stateKey);
            },
            { room, eventType, stateKey },
        );
        expect(event).toMatchObject(eventContent);
    });

    test("should fail to send an event type which is not allowed", async ({ page, room }) => {
        const eventType = "com.example.event";
        const eventContent = {
            foo: "bar",
        };
        const stateKey = "";

        // Send the event
        await sendActionFromIntegrationManager(
            page,
            integrationManagerUrl,
            room.roomId,
            eventType,
            stateKey,
            eventContent,
        );

        // Check the response
        const iframe = page.frameLocator(`iframe[src*="${integrationManagerUrl}"]`);
        await expect(iframe.locator("#message-response")).toContainText("Failed to send event");
    });
});
