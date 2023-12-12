/*
Copyright 2022 - 2023 The Matrix.org Foundation C.I.C.

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

import type { Page } from "@playwright/test";
import { test, expect } from "../../element-web-test";
import { openIntegrationManager } from "./utils";

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

async function closeIntegrationManager(page: Page, integrationManagerUrl: string) {
    const iframe = page.frameLocator(`iframe[src*="${integrationManagerUrl}"]`);
    await iframe.getByRole("button", { name: "Press to close" }).click();
}

async function sendActionFromIntegrationManager(
    page: Page,
    integrationManagerUrl: string,
    targetRoomId: string,
    targetUserId: string,
) {
    const iframe = page.frameLocator(`iframe[src*="${integrationManagerUrl}"]`);
    await iframe.locator("#target-room-id").fill(targetRoomId);
    await iframe.locator("#target-user-id").fill(targetUserId);
    await iframe.getByRole("button", { name: "Press to send action" }).click();
}

async function clickUntilGone(page: Page, selector: string, attempt = 0) {
    if (attempt === 11) {
        throw new Error("clickUntilGone attempt count exceeded");
    }

    await page.locator(selector).last().click();

    const count = await page.locator(selector).count();
    if (count > 0) {
        return clickUntilGone(page, selector, ++attempt);
    }
}

async function expectKickedMessage(page: Page, shouldExist: boolean) {
    // Expand any event summaries, we can't use a click multiple here because clicking one might de-render others
    // This is quite horrible but seems the most stable way of clicking 0-N buttons,
    // one at a time with a full re-evaluation after each click
    await clickUntilGone(page, ".mx_GenericEventListSummary_toggle[aria-expanded=false]");

    // Check for the event message (or lack thereof)
    await expect(page.getByText(`${USER_DISPLAY_NAME} removed ${BOT_DISPLAY_NAME}: ${KICK_REASON}`)).toBeVisible({
        visible: shouldExist,
    });
}

test.describe("Integration Manager: Kick", () => {
    test.use({
        displayName: "Alice",
        room: async ({ user, app }, use) => {
            const roomId = await app.client.createRoom({
                name: ROOM_NAME,
            });
            await use({ roomId });
        },
        botCreateOpts: {
            displayName: BOT_DISPLAY_NAME,
            autoAcceptInvites: true,
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
            },
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
    });

    test("should kick the target", async ({ page, app, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);
        await app.client.inviteUser(room.roomId, targetUser.credentials.userId);
        await expect(page.getByText(`${BOT_DISPLAY_NAME} joined the room`)).toBeVisible();

        await openIntegrationManager(page);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, true);
    });

    test("should not kick the target if lacking permissions", async ({ page, app, user, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);
        await app.client.inviteUser(room.roomId, targetUser.credentials.userId);
        await expect(page.getByText(`${BOT_DISPLAY_NAME} joined the room`)).toBeVisible();

        await app.client.sendStateEvent(room.roomId, "m.room.power_levels", {
            kick: 50,
            users: {
                [user.userId]: 0,
            },
        });

        await openIntegrationManager(page);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, false);
    });

    test("should no-op if the target already left", async ({ page, app, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);
        await app.client.inviteUser(room.roomId, targetUser.credentials.userId);
        await expect(page.getByText(`${BOT_DISPLAY_NAME} joined the room`)).toBeVisible();
        await targetUser.leave(room.roomId);

        await openIntegrationManager(page);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, false);
    });

    test("should no-op if the target was banned", async ({ page, app, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);
        await app.client.inviteUser(room.roomId, targetUser.credentials.userId);
        await expect(page.getByText(`${BOT_DISPLAY_NAME} joined the room`)).toBeVisible();
        await app.client.ban(room.roomId, targetUser.credentials.userId);

        await openIntegrationManager(page);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, false);
    });

    test("should no-op if the target was never a room member", async ({ page, app, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);

        await openIntegrationManager(page);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, false);
    });
});
