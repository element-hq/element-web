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
    const id = await app.client.createRoom({
        name: roomName,
        visibility,
        power_level_content_override: {
            events: {
                "org.matrix.msc3401.call.member": 0,
            },
        },
    });
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
        const callers = [
            new Bot(page, homeserver, {
                displayName: "Caller One",
                autoAcceptInvites: false,
                startClient: true,
            }),
            new Bot(page, homeserver, {
                displayName: "Caller Two",
                autoAcceptInvites: false,
                startClient: true,
            }),
        ];
        for (const caller of callers) {
            await caller.joinRoom(roomId);
            await caller.awaitRoomMembership(roomId);
        }
        const callerUserIds = await Promise.all(
            callers.map((caller) => caller.evaluate((client) => client.getSafeUserId())),
        );
        await app.viewRoomByName(ROOM_NAME);
        const memberlist = await app.toggleMemberlistPanel();
        const callerTiles = callers.map((_, index) =>
            memberlist.locator(".mx_MemberTileView").filter({
                has: page.getByText(`Caller ${index === 0 ? "One" : "Two"}`, { exact: true }),
            }),
        );
        const callIcons = callerTiles.map((tile) => tile.locator(".mx_RoomMemberTileView_callIcon"));
        await expect(callIcons[0]).toHaveCount(0);
        await expect(callIcons[1]).toHaveCount(0);

        for (const caller of callers) {
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
        }

        await expect
            .poll(
                () =>
                    app.client.evaluate(
                        (client, { roomId, callerUserIds }) => {
                            const room = client.getRoom(roomId)!;
                            const participantUserIds = new Set(
                                client.matrixRTC
                                    .getRoomSession(room)
                                    .memberships.map((membership) => membership.userId),
                            );
                            return callerUserIds.every((userId) => participantUserIds.has(userId));
                        },
                        { roomId, callerUserIds },
                    ),
                { timeout: 15_000 },
            )
            .toBe(true);

        await expect(callIcons[0]).toBeVisible();
        await expect(callIcons[1]).toBeVisible();
        await expect(callerTiles[0]).toHaveAccessibleName("Caller One, in a call");
        await expect(callerTiles[1]).toHaveAccessibleName("Caller Two, in a call");
        await expect(memberlist.locator(".mx_RoomMemberTileView_callIcon")).toHaveCount(2);
        await expect(memberlist.getByRole("option").nth(0)).toHaveAccessibleName("Caller One, in a call");
        await expect(memberlist.getByRole("option").nth(1)).toHaveAccessibleName("Caller Two, in a call");
        await expect(memberlist.locator(".mx_MemberListView_callParticipantSeparator")).toHaveCount(1);
        await expect(memberlist.locator(".mx_MemberListView_separator")).toHaveCount(2);
        expect(
            await memberlist.getByRole("option").evaluateAll((options) =>
                options.map((option) => ({
                    position: Number(option.getAttribute("aria-posinset")),
                    size: Number(option.getAttribute("aria-setsize")),
                })),
            ),
        ).toEqual([
            { position: 1, size: 6 },
            { position: 2, size: 6 },
            { position: 3, size: 6 },
            { position: 4, size: 6 },
            { position: 5, size: 6 },
            { position: 6, size: 6 },
        ]);
        await callers[0].evaluate(async (client, roomId) => {
            const room = client.getRoom(roomId)!;
            await client.matrixRTC.getRoomSession(room).leaveRoomSession(5_000);
        }, roomId);
        await expect(callIcons[0]).toHaveCount(0, { timeout: 10_000 });
        await expect(callIcons[1]).toBeVisible();
        await expect(memberlist.getByRole("option").first()).toHaveAccessibleName("Caller Two, in a call");
        await expect(memberlist.locator(".mx_RoomMemberTileView_callIcon")).toHaveCount(1);
        await expect(memberlist.locator(".mx_MemberListView_callParticipantSeparator")).toHaveCount(1);

        await callers[1].evaluate(async (client, roomId) => {
            const room = client.getRoom(roomId)!;
            await client.matrixRTC.getRoomSession(room).leaveRoomSession(5_000);
        }, roomId);
        await expect(callIcons[1]).toHaveCount(0, { timeout: 10_000 });
        await expect(memberlist.locator(".mx_MemberListView_callParticipantSeparator")).toHaveCount(0);
        await expect(memberlist.locator(".mx_MemberListView_separator")).toHaveCount(1);
        await expect(memberlist.getByRole("option").first()).not.toHaveAccessibleName(/Caller/);
    });
});
