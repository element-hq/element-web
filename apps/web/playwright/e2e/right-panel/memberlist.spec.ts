/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { test, expect } from "../../element-web-test";
import { Bot } from "../../pages/bot";

const ROOM_NAME = "Test room";
const NAME = "Alice";

async function setupRoomWithMembers(
    app: any,
    page: any,
    homeserver: any,
    roomName: string,
    memberNames: string[],
): Promise<string> {
    const visibility = await page.evaluate(() => (window as any).matrixcs.Visibility.Public);
    const id = await app.client.createRoom({ name: roomName, visibility });
    const bots: Bot[] = [];

    for (let i = 0; i < memberNames.length; i++) {
        const displayName = memberNames[i];
        const bot = new Bot(page, homeserver, { displayName, startClient: false, autoAcceptInvites: false });
        if (displayName === "Susan") {
            await bot.prepareClient();
            await app.client.inviteUser(id, bot.credentials?.userId);
        } else {
            await bot.joinRoom(id);
        }
        bots.push(bot);
    }

    return id;
}

test.use({
    synapseConfig: {
        presence: {
            enabled: false,
            include_offline_users_on_sync: false,
        },
    },
    displayName: NAME,
    disablePresence: true,
});

test.describe("Memberlist", () => {
    let roomId: string;

    test.beforeEach(async ({ app, user, page, homeserver }, testInfo) => {
        testInfo.setTimeout(testInfo.timeout + 30_000);
        const names = ["Bob", "Bob", "Susan"];
        roomId = await setupRoomWithMembers(app, page, homeserver, ROOM_NAME, names);
    });

    test("Renders correctly", { tag: "@screenshot" }, async ({ page, app }) => {
        await app.viewRoomByName(ROOM_NAME);
        const memberlist = await app.toggleMemberlistPanel();
        await expect(memberlist.locator(".mx_MemberTileView")).toHaveCount(4);
        await expect(memberlist.getByText("Invited")).toHaveCount(1);
        await expect(page.locator(".mx_MemberListView")).toMatchScreenshot("with-four-members.png");
    });

    test("should handle scroll and click to view member profile", async ({ page, app, homeserver }) => {
        // Create a room with many members to enable scrolling
        const memberNames = Array.from({ length: 15 }, (_, i) => `Member${i.toString()}`);
        await setupRoomWithMembers(app, page, homeserver, "Large Room", memberNames);

        // Navigate to the room and open member list
        await app.viewRoomByName("Large Room");

        const memberlist = await app.toggleMemberlistPanel();

        // Get the scrollable container
        const memberListContainer = memberlist.locator(".mx_AutoHideScrollbar");

        // Scroll down to the bottom of the member list
        await app.scrollListToBottom(memberListContainer);

        // Wait for the target member to be visible after scrolling
        // Member9 is the last in the list as they are lexicographically sorted
        const targetName = "Member9";
        const targetMember = memberlist.locator(".mx_MemberTileView_name").filter({ hasText: targetName });
        await targetMember.waitFor({ state: "visible" });
        // Alice is not visible and will require scrolling to,
        // but is likely in the dom as we have an overscan on the top and bottom of the list.
        // Click on a member near the bottom of the list
        await expect(targetMember).toBeVisible();
        await targetMember.click();

        // Verify that the user info screen is shown and hasn't scrolled back to top
        await expect(page.locator(".mx_UserInfo")).toBeVisible();
        await expect(page.locator(".mx_UserInfo_profile").getByText(targetName)).toBeVisible();
    });

    test("shows which room members are participating in a call", async ({ page, app, homeserver }) => {
        const caller = new Bot(page, homeserver, {
            displayName: "Caller",
            autoAcceptInvites: false,
            startClient: true,
        });
        await caller.joinRoom(roomId);
        const callerUserId = await caller.evaluate((client) => client.getSafeUserId());

        await caller.evaluate((client, roomId) => {
            const room = client.getRoom(roomId)!;
            const userId = client.getSafeUserId();
            const deviceId = client.getDeviceId()!;
            client.matrixRTC
                .getRoomSession(room)
                .joinRTCSession({ userId, deviceId, memberId: `${userId}:${deviceId}` }, [], undefined, {
                    callIntent: "video",
                });
        }, roomId);

        await expect
            .poll(() =>
                app.client.evaluate(
                    (client, { roomId, callerUserId }) => {
                        const room = client.getRoom(roomId)!;
                        return client.matrixRTC
                            .getRoomSession(room)
                            .memberships.some((membership) => membership.userId === callerUserId);
                    },
                    { roomId, callerUserId },
                ),
            )
            .toBe(true);

        await app.viewRoomByName(ROOM_NAME);
        const memberlist = await app.toggleMemberlistPanel();
        const callerTile = memberlist.locator(`.mx_MemberTileView[aria-label="Caller"]`);
        const callIcon = callerTile.locator(".mx_RoomMemberTileView_callIcon");
        await expect(callIcon).toBeVisible();
        await expect(memberlist.locator(".mx_RoomMemberTileView_callIcon")).toHaveCount(1);

        await caller.evaluate(async (client, roomId) => {
            const room = client.getRoom(roomId)!;
            await client.matrixRTC.getRoomSession(room).leaveRoomSession(5_000);
        }, roomId);
        await expect(callIcon).toHaveCount(0);
    });
});
