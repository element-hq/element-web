/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { act } from "react";
import { waitFor } from "jest-matrix-react";
import { type Room, type RoomMember, MatrixEvent } from "matrix-js-sdk/src/matrix";

import type React from "react";
import { filterConsole } from "../../../../../test-utils";
import { type Rendered, renderMemberList } from "./common";

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

type Children = (args: { height: number; width: number }) => React.JSX.Element;
jest.mock("react-virtualized", () => {
    const ReactVirtualized = jest.requireActual("react-virtualized");
    return {
        ...ReactVirtualized,
        AutoSizer: ({ children }: { children: Children }) => children({ height: 1000, width: 1000 }),
    };
});
jest.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(1500);
jest.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(1500);

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

                const tiles = root.container.querySelectorAll(".mx_MemberTileView");
                expectOrderedByPresenceAndPowerLevel(memberListRoom, tiles, enablePresence);
            });

            it("by power level", async () => {
                const { reRender, root, memberListRoom } = rendered;
                // We already have admin, moderator, and default users so leave them alone

                await reRender();

                const tiles = root.container.querySelectorAll(".mx_EntityTile");
                expectOrderedByPresenceAndPowerLevel(memberListRoom, tiles, enablePresence);
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

                const tiles = root.container.querySelectorAll(".mx_EntityTile");
                expectOrderedByPresenceAndPowerLevel(memberListRoom, tiles, enablePresence);
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

                const tiles = root.container.querySelectorAll(".mx_EntityTile");
                expectOrderedByPresenceAndPowerLevel(memberListRoom, tiles, enablePresence);
            });
        });
    });
});
