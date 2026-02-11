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

async function expectKickedMessage(page: Page, shouldExist: boolean) {
    await expect(async () => {
        await page.locator(".mx_GenericEventListSummary_toggle[aria-expanded=false]").last().click();
        await expect(page.getByText(`${USER_DISPLAY_NAME} removed ${BOT_DISPLAY_NAME}: ${KICK_REASON}`)).toBeVisible({
            visible: shouldExist,
        });
    }).toPass();
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
    });

    test("should kick the target", async ({ page, app, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);
        await app.client.inviteUser(room.roomId, targetUser.credentials.userId);
        await expect(page.getByText(`${BOT_DISPLAY_NAME} joined the room`)).toBeVisible();

        await openIntegrationManager(app);
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

        await openIntegrationManager(app);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, false);
    });

    test("should no-op if the target already left", async ({ page, app, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);
        await app.client.inviteUser(room.roomId, targetUser.credentials.userId);
        await expect(page.getByText(`${BOT_DISPLAY_NAME} joined the room`)).toBeVisible();
        await targetUser.leave(room.roomId);

        await openIntegrationManager(app);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, false);
    });

    test("should no-op if the target was banned", async ({ page, app, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);
        await app.client.inviteUser(room.roomId, targetUser.credentials.userId);
        await expect(page.getByText(`${BOT_DISPLAY_NAME} joined the room`)).toBeVisible();
        await app.client.ban(room.roomId, targetUser.credentials.userId);

        await openIntegrationManager(app);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, false);
    });

    test("should no-op if the target was never a room member", async ({ page, app, bot: targetUser, room }) => {
        await app.viewRoomByName(ROOM_NAME);

        await openIntegrationManager(app);
        await sendActionFromIntegrationManager(page, integrationManagerUrl, room.roomId, targetUser.credentials.userId);
        await closeIntegrationManager(page, integrationManagerUrl);
        await expectKickedMessage(page, false);
    });
});
