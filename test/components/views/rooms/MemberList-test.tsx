/*
Copyright 2021 Šimon Brandner <simon.bra.ag@gmail.com>
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

import React from "react";
import { act, fireEvent, render, RenderResult, screen } from "@testing-library/react";
import { Room, MatrixClient, RoomState, RoomMember, User, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { compare } from "matrix-js-sdk/src/utils";
import { mocked, MockedObject } from "jest-mock";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import * as TestUtils from "../../../test-utils";
import MemberList from "../../../../src/components/views/rooms/MemberList";
import { SDKContext } from "../../../../src/contexts/SDKContext";
import { TestSdkContext } from "../../../TestSdkContext";
import {
    filterConsole,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from "../../../test-utils";
import { shouldShowComponent } from "../../../../src/customisations/helpers/UIComponents";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";

jest.mock("../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

function generateRoomId() {
    return "!" + Math.random().toString().slice(2, 10) + ":domain";
}

describe("MemberList", () => {
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
    let memberList: MemberList;

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
                const nameCompare = compare(nameB, nameA);
                console.log("Comparing name");
                expect(nameCompare).toBeGreaterThanOrEqual(0);
            } else {
                console.log("Skipping name check due to group change");
            }
        }
    }

    function renderMemberList(enablePresence: boolean): void {
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
        const usersPerLevel = 2;
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

        const gatherWrappedRef = (r: MemberList) => {
            memberList = r;
        };
        const context = new TestSdkContext();
        context.client = client;
        context.memberListStore.isPresenceEnabled = jest.fn().mockReturnValue(enablePresence);
        root = render(
            <SDKContext.Provider value={context}>
                <MemberList
                    searchQuery=""
                    onClose={jest.fn()}
                    onSearchQueryChanged={jest.fn()}
                    roomId={memberListRoom.roomId}
                    ref={gatherWrappedRef}
                />
            </SDKContext.Provider>,
        );
    }

    describe.each([false, true])("does order members correctly (presence %s)", (enablePresence) => {
        beforeEach(function () {
            renderMemberList(enablePresence);
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

                // Bypass all the event listeners and skip to the good part
                await act(() => memberList.updateListNow(true));

                const tiles = root.container.querySelectorAll(".mx_EntityTile");
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });

            it("by power level", async () => {
                // We already have admin, moderator, and default users so leave them alone

                // Bypass all the event listeners and skip to the good part
                await act(() => memberList.updateListNow(true));

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

                // Bypass all the event listeners and skip to the good part
                await act(() => memberList.updateListNow(true));

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

                // Bypass all the event listeners and skip to the good part
                await act(() => memberList.updateListNow(true));

                const tiles = root.container.querySelectorAll(".mx_EntityTile");
                expectOrderedByPresenceAndPowerLevel(tiles, enablePresence);
            });
        });
    });

    describe("memberlist is rendered correctly", () => {
        beforeEach(function () {
            renderMemberList(true);
        });

        it("memberlist is re-rendered on unreachable presence event", async () => {
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
            expect(await screen.findByText(/User's server unreachable/)).toBeInTheDocument();
        });

        describe("Invite button", () => {
            const roomId = "!room:server.org";
            let client!: MockedObject<MatrixClient>;
            let room!: Room;

            beforeEach(function () {
                mocked(shouldShowComponent).mockReturnValue(true);
                client = getMockClientWithEventEmitter({
                    ...mockClientMethodsUser(),
                    getRoom: jest.fn(),
                    hasLazyLoadMembersEnabled: jest.fn(),
                });
                room = new Room(roomId, client, client.getSafeUserId());
                client.getRoom.mockReturnValue(room);
            });

            afterEach(() => {
                jest.restoreAllMocks();
            });

            const renderComponent = () => {
                const context = new TestSdkContext();
                context.client = client;
                render(
                    <SDKContext.Provider value={context}>
                        <MemberList
                            searchQuery=""
                            onClose={jest.fn()}
                            onSearchQueryChanged={jest.fn()}
                            roomId={room.roomId}
                        />
                    </SDKContext.Provider>,
                );
            };

            it("does not render invite button when current user is not a member", async () => {
                renderComponent();
                await flushPromises();

                expect(screen.queryByText("Invite to this room")).not.toBeInTheDocument();
            });

            it("does not render invite button UI customisation hides invites", async () => {
                mocked(shouldShowComponent).mockReturnValue(false);
                renderComponent();
                await flushPromises();

                expect(screen.queryByText("Invite to this room")).not.toBeInTheDocument();
            });

            it("renders disabled invite button when current user is a member but does not have rights to invite", async () => {
                jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
                jest.spyOn(room, "canInvite").mockReturnValue(false);

                renderComponent();
                await flushPromises();

                // button rendered but disabled
                expect(screen.getByText("Invite to this room")).toHaveAttribute("aria-disabled", "true");
            });

            it("renders enabled invite button when current user is a member and has rights to invite", async () => {
                jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
                jest.spyOn(room, "canInvite").mockReturnValue(true);

                renderComponent();
                await flushPromises();

                expect(screen.getByText("Invite to this room")).not.toBeDisabled();
            });

            it("opens room inviter on button click", async () => {
                jest.spyOn(defaultDispatcher, "dispatch");
                jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
                jest.spyOn(room, "canInvite").mockReturnValue(true);

                renderComponent();
                await flushPromises();

                fireEvent.click(screen.getByText("Invite to this room"));

                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                    action: "view_invite",
                    roomId,
                });
            });
        });
    });
});
