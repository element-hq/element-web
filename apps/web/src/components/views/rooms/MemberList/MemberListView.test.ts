/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { act } from "react";
import { describe, it, expect, beforeEach, vi, type MockInstance } from "vitest";
import { waitFor, fireEvent } from "test-utils-rtl";
import { filterConsole, mkThirdPartyInviteEvent } from "test-utils";
import { type Room, type RoomMember, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type CallMembership, MatrixRTCSessionEvent } from "matrix-js-sdk/src/matrixrtc";

import { CallStore, CallStoreEvent } from "../../../../stores/CallStore";
import { type Rendered, renderMemberList } from "./__mocks__";

vi.mock("../../../../customisations/helpers/UIComponents", () => ({
    shouldShowComponent: vi.fn(),
}));

vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(1500);
vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1500);

describe("MemberListView and MemberlistHeaderView", () => {
    filterConsole(
        "Age for event was not available, using `now - origin_server_ts` as a fallback. If the device clock is not correct issues might occur.",
    );

    function memberString(member: RoomMember): string {
        if (!member) {
            return "(null)";
        } else {
            const u = member.user;
            return (
                "(" +
                member.name +
                ", " +
                member.powerLevel +
                ", " +
                (u ? u.lastActiveAgo : "<null>") +
                ", " +
                (u ? u.getLastActiveTs() : "<null>") +
                ", " +
                (u ? u.currentlyActive : "<null>") +
                ", " +
                (u ? u.presence : "<null>") +
                ")"
            );
        }
    }

    function expectOrderedByPresenceAndPowerLevel(
        memberListRoom: Room,
        memberTiles: NodeListOf<Element>,
        isPresenceEnabled: boolean,
    ) {
        let prevMember: RoomMember | undefined;
        for (const tile of memberTiles) {
            const memberA = prevMember;
            const memberB = memberListRoom.currentState.members[tile.getAttribute("aria-label")!.split(" ")[0]];
            prevMember = memberB; // just in case an expect fails, set this early
            if (!memberA) {
                continue;
            }

            console.log("COMPARING A VS B:", memberString(memberA), memberString(memberB));

            const userA = memberA.user!;
            const userB = memberB.user!;

            let groupChange = false;

            if (isPresenceEnabled) {
                const convertPresence = (p: string) => (p === "unavailable" ? "online" : p);
                const presenceIndex = (p: string) => {
                    const order = ["active", "online", "offline"];
                    const idx = order.indexOf(convertPresence(p));
                    return idx === -1 ? order.length : idx; // unknown states at the end
                };

                const idxA = presenceIndex(userA.currentlyActive ? "active" : userA.presence);
                const idxB = presenceIndex(userB.currentlyActive ? "active" : userB.presence);
                console.log("Comparing presence groups...");
                expect(idxB).toBeGreaterThanOrEqual(idxA);
                groupChange = idxA !== idxB;
            } else {
                console.log("Skipped presence groups");
            }

            if (!groupChange) {
                console.log("Comparing power levels...");
                expect(memberA.powerLevel).toBeGreaterThanOrEqual(memberB.powerLevel);
                groupChange = memberA.powerLevel !== memberB.powerLevel;
            } else {
                console.log("Skipping power level check due to group change");
            }

            if (!groupChange) {
                if (isPresenceEnabled) {
                    console.log("Comparing last active timestamp...");
                    expect(userB.getLastActiveTs()).toBeLessThanOrEqual(userA.getLastActiveTs());
                    groupChange = userA.getLastActiveTs() !== userB.getLastActiveTs();
                } else {
                    console.log("Skipping last active timestamp");
                }
            } else {
                console.log("Skipping last active timestamp check due to group change");
            }

            if (!groupChange) {
                const nameA = memberA.name[0] === "@" ? memberA.name.slice(1) : memberA.name;
                const nameB = memberB.name[0] === "@" ? memberB.name.slice(1) : memberB.name;
                const collator = new Intl.Collator();
                const nameCompare = collator.compare(nameB, nameA);
                console.log("Comparing name");
                expect(nameCompare).toBeGreaterThanOrEqual(0);
            } else {
                console.log("Skipping name check due to group change");
            }
        }
    }

    describe("MemberListView", () => {
        let rendered: Rendered;

        beforeEach(async function () {
            rendered = await renderMemberList(true);
        });

        it("Memberlist is re-rendered on unreachable presence event", async () => {
            const { root, defaultUsers } = rendered;
            await act(async () => {
                defaultUsers[0].user?.setPresenceEvent(
                    new MatrixEvent({
                        type: "m.presence",
                        sender: defaultUsers[0].userId,
                        content: {
                            presence: "io.element.unreachable",
                            currently_active: false,
                        },
                    }),
                );
            });
            await waitFor(() => {
                expect(root.container.querySelector(".mx_PresenceIconView_unavailable")).not.toBeNull();
            });
        });

        it("should prevent default form submission", async () => {
            const { root } = rendered;
            const form = root.container.querySelector("form");
            expect(form).not.toBeNull();
            const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
            const preventDefaultSpy = vi.spyOn(submitEvent, "preventDefault");
            fireEvent(form!, submitEvent);
            expect(preventDefaultSpy).toHaveBeenCalled();
        });

        it("should show and hide the call icon when a member joins and leaves the room call", async () => {
            const { root, roomSession, defaultUsers } = rendered;
            const memberTile = root.container.querySelector(`[aria-label="${defaultUsers[0].userId}"]`)!;
            expect(memberTile.querySelector(".mx_RoomMemberTileView_callIcon")).toBeNull();
            expect(root.container.querySelector(".mx_MemberListView_separator")).toBeNull();

            const membership = { userId: defaultUsers[0].userId } as CallMembership;
            await act(async () => {
                roomSession.memberships = [membership];
                roomSession.emit(MatrixRTCSessionEvent.MembershipsChanged, [], [membership]);
            });
            expect(memberTile.querySelector(".mx_RoomMemberTileView_callIcon")).not.toBeNull();
            expect(root.container.querySelector(".mx_MemberListView_separator")).not.toBeNull();
            expect(root.container.querySelector(".mx_MemberTileView")).toHaveAccessibleName(
                `${defaultUsers[0].userId}, in a call`,
            );

            await act(async () => {
                roomSession.memberships = [];
                roomSession.emit(MatrixRTCSessionEvent.MembershipsChanged, [membership], []);
            });
            expect(memberTile.querySelector(".mx_RoomMemberTileView_callIcon")).toBeNull();
            expect(root.container.querySelector(".mx_MemberListView_separator")).toBeNull();
            expect(memberTile).toHaveAccessibleName(defaultUsers[0].userId);
        });

        it("should react to calls appearing, being replaced, and ending", async () => {
            const { root, call, otherRoomCall, memberListRoom } = await renderMemberList(
                true,
                undefined,
                2,
                [],
                [{ userId: "@admin0:localhost" } as CallMembership],
                [{ userId: "@default0:localhost" } as CallMembership],
            );
            const expectCaller = (userId: string): void => {
                expect(root.container.querySelectorAll(".mx_RoomMemberTileView_callIcon")).toHaveLength(1);
                expect(root.container.querySelector(".mx_MemberTileView")).toHaveAccessibleName(`${userId}, in a call`);
            };
            expectCaller("@admin0:localhost");

            await act(async () => {
                CallStore.instance.emit(CallStoreEvent.Call, otherRoomCall, "!other:localhost");
            });
            expectCaller("@admin0:localhost");

            await act(async () => {
                CallStore.instance.emit(CallStoreEvent.Call, otherRoomCall, memberListRoom.roomId);
            });
            expectCaller("@default0:localhost");

            await act(async () => {
                CallStore.instance.emit(CallStoreEvent.Call, null, memberListRoom.roomId);
            });
            expect(root.container.querySelector(".mx_RoomMemberTileView_callIcon")).toBeNull();
            expect(root.container.querySelector(".mx_MemberListView_separator")).toBeNull();

            await act(async () => {
                CallStore.instance.emit(CallStoreEvent.Call, call, memberListRoom.roomId);
            });
            expectCaller("@admin0:localhost");
        });

        it("should preserve an active search when call memberships change", async () => {
            const { root, roomSession, adminUsers } = await renderMemberList(true, undefined, 7);
            const searchInput = root.container.querySelector<HTMLInputElement>('input[name="searchMembers"]')!;

            fireEvent.change(searchInput, { target: { value: "admin0" } });
            await waitFor(() => {
                expect(root.container.querySelectorAll(".mx_MemberTileView")).toHaveLength(1);
            });

            const membership = { userId: adminUsers[0].userId } as CallMembership;
            await act(async () => {
                roomSession.memberships = [membership];
                roomSession.emit(MatrixRTCSessionEvent.MembershipsChanged, [], [membership]);
            });

            expect(searchInput).toHaveValue("admin0");
            await waitFor(() => {
                expect(root.container.querySelectorAll(".mx_MemberTileView")).toHaveLength(1);
                expect(root.container.querySelector(".mx_RoomMemberTileView_callIcon")).not.toBeNull();
            });
        });

        it("should ignore stale member loads after call memberships change", async () => {
            const { root, roomSession, context, memberListRoom, adminUsers, moderatorUsers } = rendered;
            const loadResult = await context.memberListStore.loadMemberList(memberListRoom.roomId);
            const firstLoad = Promise.withResolvers<typeof loadResult>();
            const secondLoad = Promise.withResolvers<typeof loadResult>();
            const loadMemberList = vi
                .spyOn(context.memberListStore, "loadMemberList")
                .mockImplementationOnce(() => firstLoad.promise)
                .mockImplementationOnce(() => secondLoad.promise);
            const firstMembership = { userId: adminUsers[0].userId } as CallMembership;
            const secondMembership = { userId: moderatorUsers[0].userId } as CallMembership;

            await act(async () => {
                roomSession.memberships = [firstMembership];
                roomSession.emit(MatrixRTCSessionEvent.MembershipsChanged, [], [firstMembership]);
            });
            await waitFor(() => expect(loadMemberList).toHaveBeenCalledTimes(1));

            await act(async () => {
                roomSession.memberships = [secondMembership];
                roomSession.emit(MatrixRTCSessionEvent.MembershipsChanged, [firstMembership], [secondMembership]);
            });
            await waitFor(() => expect(loadMemberList).toHaveBeenCalledTimes(2));

            await act(async () => secondLoad.resolve(loadResult));
            await waitFor(() => {
                expect(root.container.querySelector(".mx_MemberTileView")).toHaveAccessibleName(
                    `${moderatorUsers[0].userId}, in a call`,
                );
            });

            await act(async () => firstLoad.resolve(loadResult));
            expect(root.container.querySelector(".mx_MemberTileView")).toHaveAccessibleName(
                `${moderatorUsers[0].userId}, in a call`,
            );
        });

        it("should remain loading when a stale initial member load resolves", async () => {
            type LoadResult = Awaited<ReturnType<Rendered["context"]["memberListStore"]["loadMemberList"]>>;
            const discardedStrictModeLoad = Promise.withResolvers<LoadResult>();
            const initialLoad = Promise.withResolvers<LoadResult>();
            const membershipLoad = Promise.withResolvers<LoadResult>();
            const setup = Promise.withResolvers<{
                roomSession: Rendered["roomSession"];
                loadMemberList: MockInstance<Rendered["context"]["memberListStore"]["loadMemberList"]>;
                loadResult: LoadResult;
            }>();
            const renderPromise = renderMemberList(
                true,
                undefined,
                2,
                [],
                [],
                [],
                0,
                async (context, roomSession, memberListRoom) => {
                    const loadResult = await context.memberListStore.loadMemberList(memberListRoom.roomId);
                    const loadMemberList = vi
                        .spyOn(context.memberListStore, "loadMemberList")
                        .mockImplementationOnce(() => discardedStrictModeLoad.promise)
                        .mockImplementationOnce(() => initialLoad.promise)
                        .mockImplementationOnce(() => membershipLoad.promise);
                    setup.resolve({ roomSession, loadMemberList, loadResult });
                },
            );
            const { roomSession, loadMemberList, loadResult } = await setup.promise;
            await waitFor(() => expect(loadMemberList).toHaveBeenCalledTimes(2));

            const membership = { userId: "@moderator0:localhost" } as CallMembership;
            await act(async () => {
                roomSession.memberships = [membership];
                roomSession.emit(MatrixRTCSessionEvent.MembershipsChanged, [], [membership]);
            });
            await waitFor(() => expect(loadMemberList).toHaveBeenCalledTimes(3));

            await act(async () => initialLoad.resolve(loadResult));
            expect(document.body).toHaveTextContent("Loading");

            await act(async () => membershipLoad.resolve(loadResult));
            const { root } = await renderPromise;
            expect(root.container.querySelector(".mx_MemberTileView")).toHaveAccessibleName(
                "@moderator0:localhost, in a call",
            );
            await act(async () => discardedStrictModeLoad.resolve(loadResult));
        });

        it("should group call participants first while preserving the order within both groups", async () => {
            const participantUserIds = ["@moderator1:localhost", "@default0:localhost"];
            const memberships = participantUserIds.map((userId) => ({ userId }) as CallMembership);
            const { root } = await renderMemberList(true, undefined, 2, [], memberships);

            const memberTiles = Array.from(root.container.querySelectorAll(".mx_MemberTileView"));
            const orderedUserIds = memberTiles.map((tile) => tile.getAttribute("aria-label")!.split(", in a call")[0]);
            expect(orderedUserIds).toEqual([
                "@moderator1:localhost",
                "@default0:localhost",
                "@admin0:localhost",
                "@admin1:localhost",
                "@moderator0:localhost",
                "@default1:localhost",
            ]);
            expect(root.container.querySelectorAll(".mx_MemberListView_separator")).toHaveLength(1);
            expect(memberTiles.map((tile) => tile.getAttribute("aria-posinset"))).toEqual([
                "1",
                "2",
                "3",
                "4",
                "5",
                "6",
            ]);
        });

        it("should not render adjacent separators when all joined members are in the call", async () => {
            const participantUserIds = [
                "@admin0:localhost",
                "@admin1:localhost",
                "@moderator0:localhost",
                "@moderator1:localhost",
                "@default0:localhost",
                "@default1:localhost",
            ];
            const memberships = participantUserIds.map((userId) => ({ userId }) as CallMembership);
            const { root } = await renderMemberList(true, undefined, 2, [], memberships, [], 1);

            expect(root.container.querySelectorAll(".mx_MemberListView_separator")).toHaveLength(1);
            expect(root.container.querySelectorAll(".mx_RoomMemberTileView_callIcon")).toHaveLength(6);
        });

        it("should not count separators as members when deciding whether to show search", async () => {
            const memberships = [{ userId: "@admin0:localhost" }] as CallMembership[];
            const { root } = await renderMemberList(true, undefined, 6, [], memberships, [], 1);

            expect(root.container.querySelectorAll(".mx_MemberTileView")).toHaveLength(19);
            expect(root.container.querySelectorAll(".mx_MemberListView_separator")).toHaveLength(2);
            expect(root.container.querySelector(".mx_MemberListHeaderView_search")).toBeNull();
        });

        it("should show one call icon for a member with multiple devices in the room call", async () => {
            const userId = "@admin0:localhost";
            const memberships = [
                { userId, deviceId: "DEVICE_1", memberId: `${userId}:DEVICE_1` },
                { userId, deviceId: "DEVICE_2", memberId: `${userId}:DEVICE_2` },
            ] as CallMembership[];
            const { root, memberListRoom } = await renderMemberList(true, undefined, 2, [], memberships);

            expect(CallStore.instance.getCall).toHaveBeenCalledWith(memberListRoom.roomId);
            expect(root.container.querySelectorAll(".mx_RoomMemberTileView_callIcon")).toHaveLength(1);
            expect(
                root.container
                    .querySelector(`[aria-label="${userId}, in a call"]`)!
                    .querySelector(".mx_RoomMemberTileView_callIcon"),
            ).not.toBeNull();
            expect(
                root.container
                    .querySelector('[aria-label="@default0:localhost"]')!
                    .querySelector(".mx_RoomMemberTileView_callIcon"),
            ).toBeNull();
        });

        it("should ignore call memberships and updates from other rooms", async () => {
            const userId = "@admin0:localhost";
            const otherRoomMembership = {
                userId,
                deviceId: "OTHER_ROOM_DEVICE",
                memberId: `${userId}:OTHER_ROOM_DEVICE`,
            } as CallMembership;
            const { root, otherRoomSession } = await renderMemberList(
                true,
                undefined,
                2,
                [],
                [],
                [otherRoomMembership],
            );
            const memberTile = root.container.querySelector(`[aria-label="${userId}"]`)!;

            expect(memberTile.querySelector(".mx_RoomMemberTileView_callIcon")).toBeNull();
            await act(async () => {
                otherRoomSession.memberships = [otherRoomMembership];
                otherRoomSession.emit(MatrixRTCSessionEvent.MembershipsChanged, [], [otherRoomMembership]);
            });
            expect(memberTile.querySelector(".mx_RoomMemberTileView_callIcon")).toBeNull();
            expect(root.container.querySelector(".mx_MemberListView_separator")).toBeNull();
        });
    });

    describe.each([true, false])("does order members correctly (presence %s)", (enablePresence) => {
        let rendered: Rendered;

        beforeEach(async function () {
            rendered = await renderMemberList(enablePresence);
        });

        describe("does order members correctly", () => {
            // Note: even if presence is disabled, we still expect that the presence
            // tests will pass. All expectOrderedByPresenceAndPowerLevel does is ensure
            // the order is perceived correctly, regardless of what we did to the members.

            // Each of the 4 tests here is done to prove that the member list can meet
            // all 4 criteria independently. Together, they should work.

            it("by presence state", async () => {
                const { adminUsers, defaultUsers, moderatorUsers, reRender, root, memberListRoom } = rendered;
                // Intentionally pick users that will confuse the power level sorting
                const activeUsers = [defaultUsers[0]];
                const onlineUsers = [adminUsers[0]];
                const offlineUsers = [...moderatorUsers, ...adminUsers.slice(1), ...defaultUsers.slice(1)];
                activeUsers.forEach((u) => {
                    u.user!.currentlyActive = true;
                    u.user!.presence = "online";
                });
                onlineUsers.forEach((u) => {
                    u.user!.currentlyActive = false;
                    u.user!.presence = "online";
                });
                offlineUsers.forEach((u) => {
                    u.user!.currentlyActive = false;
                    u.user!.presence = "offline";
                });

                await reRender();

                await waitFor(() => {
                    const tiles = root.container.querySelectorAll(".mx_MemberTileView");
                    expectOrderedByPresenceAndPowerLevel(memberListRoom, tiles, enablePresence);
                });
            });

            it("by power level", async () => {
                const { reRender, root, memberListRoom } = rendered;
                // We already have admin, moderator, and default users so leave them alone

                await reRender();

                await waitFor(() => {
                    const tiles = root.container.querySelectorAll(".mx_EntityTile");
                    expectOrderedByPresenceAndPowerLevel(memberListRoom, tiles, enablePresence);
                });
            });

            it("by last active timestamp", async () => {
                const { adminUsers, defaultUsers, moderatorUsers, reRender, root, memberListRoom } = rendered;
                // Intentionally pick users that will confuse the power level sorting
                const activeUsers = [defaultUsers[0]];
                const semiActiveUsers = [adminUsers[0]];
                const inactiveUsers = [...moderatorUsers, ...adminUsers.slice(1), ...defaultUsers.slice(1)];
                activeUsers.forEach((u) => {
                    u.powerLevel = 100; // set everyone to the same PL to avoid running that check
                    u.user!.lastPresenceTs = 1000;
                    u.user!.lastActiveAgo = 0;
                });
                semiActiveUsers.forEach((u) => {
                    u.powerLevel = 100;
                    u.user!.lastPresenceTs = 1000;
                    u.user!.lastActiveAgo = 50;
                });
                inactiveUsers.forEach((u) => {
                    u.powerLevel = 100;
                    u.user!.lastPresenceTs = 1000;
                    u.user!.lastActiveAgo = 100;
                });

                await reRender();

                await waitFor(() => {
                    const tiles = root.container.querySelectorAll(".mx_EntityTile");
                    expectOrderedByPresenceAndPowerLevel(memberListRoom, tiles, enablePresence);
                });
            });

            it("by name", async () => {
                const { adminUsers, defaultUsers, moderatorUsers, reRender, root, memberListRoom } = rendered;
                // Intentionally put everyone on the same level to force a name comparison
                const allUsers = [...adminUsers, ...moderatorUsers, ...defaultUsers];
                allUsers.forEach((u) => {
                    u.user!.currentlyActive = true;
                    u.user!.presence = "online";
                    u.user!.lastPresenceTs = 1000;
                    u.user!.lastActiveAgo = 0;
                    u.powerLevel = 100;
                });

                await reRender();

                await waitFor(() => {
                    const tiles = root.container.querySelectorAll(".mx_EntityTile");
                    expectOrderedByPresenceAndPowerLevel(memberListRoom, tiles, enablePresence);
                });
            });
        });
    });

    describe("3PID invites", () => {
        it("does not collapse invites with duplicate display names", async () => {
            const threePidEvents = [
                mkThirdPartyInviteEvent("@alice:localhost", "user@example.com", "!room:localhost"),
                mkThirdPartyInviteEvent("@alice:localhost", "user@example.com", "!room:localhost"),
            ];
            const { root } = await renderMemberList(true, undefined, 2, threePidEvents);

            const tiles = root.container.querySelectorAll(".mx_MemberTileView");
            // 6 joined + 2 3PID invites
            expect(tiles).toHaveLength(8);
        });
    });
});
