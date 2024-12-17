/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import { fireEvent, render, RenderResult, screen, waitFor } from "jest-matrix-react";
import {
    Room,
    MatrixClient,
    RoomState,
    RoomMember,
    User,
    MatrixEvent,
    EventType,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { mocked } from "jest-mock";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import * as TestUtils from "../../../../test-utils";
import { SDKContext } from "../../../../../src/contexts/SDKContext";
import { TestSdkContext } from "../../../TestSdkContext";
import { filterConsole } from "../../../../test-utils";
import { shouldShowComponent } from "../../../../../src/customisations/helpers/UIComponents";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";
import MemberListView from "../../../../../src/components/views/rooms/MemberListView";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

jest.mock("../../../../../src/customisations/helpers/UIComponents", () => ({
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

function generateRoomId() {
    return "!" + Math.random().toString().slice(2, 10) + ":domain";
}

describe("MemberListView and MemberlistHeaderView", () => {
    filterConsole(
        "Age for event was not available, using `now - origin_server_ts` as a fallback. If the device clock is not correct issues might occur.",
    );
    function createRoom(opts = {}) {
        const room = new Room(generateRoomId(), client, client.getUserId()!);
        if (opts) {
            Object.assign(room, opts);
        }
        return room;
    }

    let client: MatrixClient;
    let root: RenderResult;
    let memberListRoom: Room;

    let adminUsers: RoomMember[] = [];
    let moderatorUsers: RoomMember[] = [];
    let defaultUsers: RoomMember[] = [];

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

    function expectOrderedByPresenceAndPowerLevel(memberTiles: NodeListOf<Element>, isPresenceEnabled: boolean) {
        let prevMember: RoomMember | undefined;
        for (const tile of memberTiles) {
            const memberA = prevMember;
            // console.log("aria-label is ", tile.getAttribute("aria-label"));
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

    async function renderMemberList(enablePresence: boolean, usersPerLevel: number = 2): Promise<void> {
        TestUtils.stubClient();
        client = MatrixClientPeg.safeGet();
        client.hasLazyLoadMembersEnabled = () => false;

        // Make room
        memberListRoom = createRoom();
        expect(memberListRoom.roomId).toBeTruthy();

        // Make users
        adminUsers = [];
        moderatorUsers = [];
        defaultUsers = [];
        for (let i = 0; i < usersPerLevel; i++) {
            const adminUser = new RoomMember(memberListRoom.roomId, `@admin${i}:localhost`);
            adminUser.membership = KnownMembership.Join;
            adminUser.powerLevel = 100;
            adminUser.user = User.createUser(adminUser.userId, client);
            adminUser.user.currentlyActive = true;
            adminUser.user.presence = "online";
            adminUser.user.lastPresenceTs = 1000;
            adminUser.user.lastActiveAgo = 10;
            adminUsers.push(adminUser);

            const moderatorUser = new RoomMember(memberListRoom.roomId, `@moderator${i}:localhost`);
            moderatorUser.membership = KnownMembership.Join;
            moderatorUser.powerLevel = 50;
            moderatorUser.user = User.createUser(moderatorUser.userId, client);
            moderatorUser.user.currentlyActive = true;
            moderatorUser.user.presence = "online";
            moderatorUser.user.lastPresenceTs = 1000;
            moderatorUser.user.lastActiveAgo = 10;
            moderatorUsers.push(moderatorUser);

            const defaultUser = new RoomMember(memberListRoom.roomId, `@default${i}:localhost`);
            defaultUser.membership = KnownMembership.Join;
            defaultUser.powerLevel = 0;
            defaultUser.user = User.createUser(defaultUser.userId, client);
            defaultUser.user.currentlyActive = true;
            defaultUser.user.presence = "online";
            defaultUser.user.lastPresenceTs = 1000;
            defaultUser.user.lastActiveAgo = 10;
            defaultUsers.push(defaultUser);
        }

        client.getRoom = (roomId) => {
            if (roomId === memberListRoom.roomId) return memberListRoom;
            else return null;
        };
        memberListRoom.currentState = {
            members: {},
            getMember: jest.fn(),
            getStateEvents: ((eventType, stateKey) =>
                stateKey === undefined ? [] : null) as RoomState["getStateEvents"], // ignore 3pid invites
        } as unknown as RoomState;
        for (const member of [...adminUsers, ...moderatorUsers, ...defaultUsers]) {
            memberListRoom.currentState.members[member.userId] = member;
        }

        const context = new TestSdkContext();
        context.client = client;
        context.memberListStore.isPresenceEnabled = jest.fn().mockReturnValue(enablePresence);
        root = render(
            <MatrixClientContext.Provider value={client}>
                <SDKContext.Provider value={context}>
                    <MemberListView roomId={memberListRoom.roomId} onClose={() => {}} />
                </SDKContext.Provider>
            </MatrixClientContext.Provider>,
        );
        await waitFor(async () => {
            expect(root.container.querySelectorAll(".mx_MemberTileView")).toHaveLength(usersPerLevel * 3);
        });
    }

    async function reRenderMemberList(): Promise<void> {
        await act(async () => {
            //@ts-ignore
            client.emit(RoomStateEvent.Events, {
                //@ts-ignore
                getType: () => EventType.RoomThirdPartyInvite,
                getRoomId: () => memberListRoom.roomId,
            });
        });
        // todo: is this going to flake?
        await new Promise((r) => setTimeout(r, 1000));
    }

    describe("MemberListView", () => {
        beforeEach(async function () {
            await renderMemberList(true);
        });

        it("Memberlist is re-rendered on unreachable presence event", async () => {
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
        beforeEach(async function () {
            await renderMemberList(enablePresence);
        });

        describe("does order members correctly", () => {
            // Note: even if presence is disabled, we still expect that the presence
            // tests will pass. All expectOrderedByPresenceAndPowerLevel does is ensure
            // the order is perceived correctly, regardless of what we did to the members.

            // Each of the 4 tests here is done to prove that the member list can meet
            // all 4 criteria independently. Together, they should work.

            it("by presence state", async () => {
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

                await reRenderMemberList();

                const tiles = root.container.querySelectorAll(".mx_MemberTileView");
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });

            it("by power level", async () => {
                // We already have admin, moderator, and default users so leave them alone

                await reRenderMemberList();

                const tiles = root.container.querySelectorAll(".mx_EntityTile");
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });

            it("by last active timestamp", async () => {
                // Intentionally pick users that will confuse the power level sorting
                // lastActiveAgoTs == lastPresenceTs - lastActiveAgo
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

                await reRenderMemberList();

                const tiles = root.container.querySelectorAll(".mx_EntityTile");
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });

            it("by name", async () => {
                // Intentionally put everyone on the same level to force a name comparison
                const allUsers = [...adminUsers, ...moderatorUsers, ...defaultUsers];
                allUsers.forEach((u) => {
                    u.user!.currentlyActive = true;
                    u.user!.presence = "online";
                    u.user!.lastPresenceTs = 1000;
                    u.user!.lastActiveAgo = 0;
                    u.powerLevel = 100;
                });

                await reRenderMemberList();

                const tiles = root.container.querySelectorAll(".mx_EntityTile");
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });
        });
    });

    describe("MemberListHeaderView", () => {
        beforeEach(async function () {
            await renderMemberList(true);
        });

        it("Shows the correct member count", async () => {
            expect(await screen.findByText("6 Members")).toBeVisible();
        });

        it("Does not show search box when there's less than 20 members", async () => {
            expect(screen.queryByPlaceholderText("Filter People...")).toBeNull();
        });

        it("Shows search box when there's more than 20 members", async () => {
            // Memberlist already has 6 members, add 14 more to make the total 20
            for (let i = 0; i < 14; ++i) {
                const newMember = new RoomMember(memberListRoom.roomId, `@new${i}:localhost`);
                newMember.membership = KnownMembership.Join;
                newMember.powerLevel = 0;
                newMember.user = User.createUser(newMember.userId, client);
                newMember.user.currentlyActive = true;
                newMember.user.presence = "online";
                newMember.user.lastPresenceTs = 1000;
                newMember.user.lastActiveAgo = 10;
                memberListRoom.currentState.members[newMember.userId] = newMember;
            }
            await reRenderMemberList();
            expect(screen.queryByPlaceholderText("Filter People...")).toBeVisible();
        });

        describe("Invite button functionality", () => {
            afterEach(() => {
                jest.restoreAllMocks();
            });

            it("Does not render invite button when user is not a member", async () => {});

            it("does not render invite button UI customisation hides invites", async () => {});

            it("Renders disabled invite button when current user is a member but does not have rights to invite", async () => {
                jest.spyOn(memberListRoom, "getMyMembership").mockReturnValue(KnownMembership.Join);
                jest.spyOn(memberListRoom, "canInvite").mockReturnValue(false);
                mocked(shouldShowComponent).mockReturnValue(true);
                await reRenderMemberList();
                expect(screen.getByRole("button", { name: "Invite" })).toHaveAttribute("aria-disabled", "true");
            });

            it("Renders enabled invite button when current user is a member and has rights to invite", async () => {
                jest.spyOn(memberListRoom, "getMyMembership").mockReturnValue(KnownMembership.Join);
                jest.spyOn(memberListRoom, "canInvite").mockReturnValue(true);
                mocked(shouldShowComponent).mockReturnValue(true);
                await reRenderMemberList();
                expect(screen.getByRole("button", { name: "Invite" })).not.toHaveAttribute("aria-disabled", "true");
            });

            it("Opens room inviter on button click", async () => {
                jest.spyOn(defaultDispatcher, "dispatch");
                jest.spyOn(memberListRoom, "getMyMembership").mockReturnValue(KnownMembership.Join);
                jest.spyOn(memberListRoom, "canInvite").mockReturnValue(true);
                mocked(shouldShowComponent).mockReturnValue(true);
                await reRenderMemberList();

                fireEvent.click(screen.getByRole("button", { name: "Invite" }));
                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                    action: "view_invite",
                    roomId: memberListRoom.roomId,
                });
            });
        });
    });
});
