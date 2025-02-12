/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from "jest-matrix-react";
import { type HierarchyRoom, JoinRule, type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { RoomHierarchy } from "matrix-js-sdk/src/room-hierarchy";

import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import { mkStubRoom, stubClient } from "../../../test-utils";
import dispatcher from "../../../../src/dispatcher/dispatcher";
import SpaceHierarchy, { showRoom, toLocalRoom } from "../../../../src/components/structures/SpaceHierarchy";
import { Action } from "../../../../src/dispatcher/actions";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import SettingsStore from "../../../../src/settings/SettingsStore";

describe("SpaceHierarchy", () => {
    describe("showRoom", () => {
        let client: MatrixClient;
        let hierarchy: RoomHierarchy;
        let room: Room;
        beforeEach(() => {
            stubClient();
            client = MatrixClientPeg.safeGet();
            room = new Room("room-id", client, "@alice:example.com");
            hierarchy = new RoomHierarchy(room);

            jest.spyOn(client, "isGuest").mockReturnValue(false);

            jest.spyOn(hierarchy.roomMap, "get").mockReturnValue({
                children_state: [],
                room_id: "room-id2",
                canonical_alias: "canonical-alias",
                aliases: ["uncanonical-alias", "canonical-alias"],
                world_readable: true,
                guest_can_join: false,
                num_joined_members: 35,
            });

            jest.spyOn(dispatcher, "dispatch");
        });

        it("shows room", () => {
            showRoom(client, hierarchy, "room-id2");
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                should_peek: true,
                room_alias: "canonical-alias",
                room_id: "room-id2",
                via_servers: [],
                oob_data: {
                    avatarUrl: undefined,
                    name: "canonical-alias",
                },
                roomType: undefined,
                metricsTrigger: "RoomDirectory",
            });
        });
    });

    describe("toLocalRoom", () => {
        stubClient();
        const client = MatrixClientPeg.safeGet();
        const roomV1 = mkStubRoom("room-id-1", "Room V1", client);
        const roomV2 = mkStubRoom("room-id-2", "Room V2", client);
        const roomV3 = mkStubRoom("room-id-3", "Room V3", client);
        jest.spyOn(client, "getRoomUpgradeHistory").mockReturnValue([roomV1, roomV2, roomV3]);

        it("grabs last room that is in hierarchy when latest version is in hierarchy", () => {
            const hierarchy = {
                roomMap: new Map([
                    [roomV1.roomId, { room_id: roomV1.roomId } as HierarchyRoom],
                    [roomV2.roomId, { room_id: roomV2.roomId } as HierarchyRoom],
                    [roomV3.roomId, { room_id: roomV3.roomId } as HierarchyRoom],
                ]),
            } as RoomHierarchy;
            const localRoomV1 = toLocalRoom(client, { room_id: roomV1.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV1.room_id).toEqual(roomV3.roomId);
            const localRoomV2 = toLocalRoom(client, { room_id: roomV2.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV2.room_id).toEqual(roomV3.roomId);
            const localRoomV3 = toLocalRoom(client, { room_id: roomV3.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV3.room_id).toEqual(roomV3.roomId);
        });

        it("grabs last room that is in hierarchy when latest version is *not* in hierarchy", () => {
            const hierarchy = {
                roomMap: new Map([
                    [roomV1.roomId, { room_id: roomV1.roomId } as HierarchyRoom],
                    [roomV2.roomId, { room_id: roomV2.roomId } as HierarchyRoom],
                ]),
            } as RoomHierarchy;
            const localRoomV1 = toLocalRoom(client, { room_id: roomV1.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV1.room_id).toEqual(roomV2.roomId);
            const localRoomV2 = toLocalRoom(client, { room_id: roomV2.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV2.room_id).toEqual(roomV2.roomId);
            const localRoomV3 = toLocalRoom(client, { room_id: roomV3.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV3.room_id).toEqual(roomV2.roomId);
        });

        it("returns specified room when none of the versions is in hierarchy", () => {
            const hierarchy = { roomMap: new Map([]) } as RoomHierarchy;
            const localRoomV1 = toLocalRoom(client, { room_id: roomV1.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV1.room_id).toEqual(roomV1.roomId);
            const localRoomV2 = toLocalRoom(client, { room_id: roomV2.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV2.room_id).toEqual(roomV2.roomId);
            const localRoomV3 = toLocalRoom(client, { room_id: roomV3.roomId } as HierarchyRoom, hierarchy);
            expect(localRoomV3.room_id).toEqual(roomV3.roomId);
        });

        describe("If the feature_dynamic_room_predecessors is not enabled", () => {
            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
            });
            it("Passes through the dynamic predecessor setting", async () => {
                mocked(client.getRoomUpgradeHistory).mockClear();
                const hierarchy = { roomMap: new Map([]) } as RoomHierarchy;
                toLocalRoom(client, { room_id: roomV1.roomId } as HierarchyRoom, hierarchy);
                expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(roomV1.roomId, true, false);
            });
        });

        describe("If the feature_dynamic_room_predecessors is enabled", () => {
            beforeEach(() => {
                // Turn on feature_dynamic_room_predecessors setting
                jest.spyOn(SettingsStore, "getValue").mockImplementation(
                    (settingName) => settingName === "feature_dynamic_room_predecessors",
                );
            });

            it("Passes through the dynamic predecessor setting", async () => {
                mocked(client.getRoomUpgradeHistory).mockClear();
                const hierarchy = { roomMap: new Map([]) } as RoomHierarchy;
                toLocalRoom(client, { room_id: roomV1.roomId } as HierarchyRoom, hierarchy);
                expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(roomV1.roomId, true, true);
            });
        });
    });

    describe("<SpaceHierarchy />", () => {
        beforeEach(() => {
            // IntersectionObserver isn't available in test environment
            const mockIntersectionObserver = jest.fn();
            mockIntersectionObserver.mockReturnValue({
                observe: () => null,
                unobserve: () => null,
                disconnect: () => null,
            } as ResizeObserver);
            window.IntersectionObserver = mockIntersectionObserver;
        });

        stubClient();
        const client = MatrixClientPeg.safeGet();

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);

        const root = mkStubRoom("space-id-1", "Space 1", client);
        const room1 = mkStubRoom("room-id-2", "Room 1", client);
        const room2 = mkStubRoom("room-id-3", "Room 2", client);
        const space1 = mkStubRoom("space-id-4", "Space 2", client);
        const room3 = mkStubRoom("room-id-5", "Room 3", client);
        mocked(client.getRooms).mockReturnValue([root]);
        mocked(client.getRoom).mockImplementation(
            (roomId) => client.getRooms().find((room) => room.roomId === roomId) ?? null,
        );
        [room1, room2, space1, room3].forEach((r) => mocked(r.getMyMembership).mockReturnValue(KnownMembership.Leave));

        const hierarchyRoot: HierarchyRoom = {
            room_id: root.roomId,
            num_joined_members: 1,
            room_type: "m.space",
            children_state: [
                {
                    state_key: room1.roomId,
                    content: { order: "1" },
                    origin_server_ts: 111,
                    type: "m.space.child",
                    sender: "@other:server",
                },
                {
                    state_key: room2.roomId,
                    content: { order: "2" },
                    origin_server_ts: 111,
                    type: "m.space.child",
                    sender: "@other:server",
                },
                {
                    state_key: space1.roomId,
                    content: { order: "3" },
                    origin_server_ts: 111,
                    type: "m.space.child",
                    sender: "@other:server",
                },
                {
                    state_key: "!knock1:server",
                    content: { order: "4" },
                    origin_server_ts: 111,
                    type: "m.space.child",
                    sender: "@other:server",
                },
            ],
            world_readable: true,
            guest_can_join: true,
        };
        const hierarchyRoom1: HierarchyRoom = {
            room_id: room1.roomId,
            num_joined_members: 2,
            children_state: [],
            world_readable: true,
            guest_can_join: true,
        };
        const hierarchyRoom2: HierarchyRoom = {
            room_id: room2.roomId,
            num_joined_members: 3,
            children_state: [],
            world_readable: true,
            guest_can_join: true,
        };
        const hierarchyRoom3: HierarchyRoom = {
            name: "Nested room",
            room_id: room3.roomId,
            num_joined_members: 3,
            children_state: [],
            world_readable: true,
            guest_can_join: true,
        };
        const hierarchySpace1: HierarchyRoom = {
            room_id: space1.roomId,
            name: "Nested space",
            num_joined_members: 1,
            room_type: "m.space",
            children_state: [
                {
                    state_key: room3.roomId,
                    content: { order: "1" },
                    origin_server_ts: 111,
                    type: "m.space.child",
                    sender: "@other:server",
                },
            ],
            world_readable: true,
            guest_can_join: true,
        };
        const hierarchyKnockRoom1: HierarchyRoom = {
            room_id: "!knock1:server",
            name: "Knock room",
            num_joined_members: 3,
            children_state: [],
            world_readable: true,
            guest_can_join: true,
            join_rule: JoinRule.Knock,
        };

        mocked(client.getRoomHierarchy).mockResolvedValue({
            rooms: [
                hierarchyRoot,
                hierarchyRoom1,
                hierarchyRoom2,
                hierarchySpace1,
                hierarchyRoom3,
                hierarchyKnockRoom1,
            ],
        });

        const defaultProps = {
            space: root,
            showRoom: jest.fn(),
        };
        const getComponent = (props = {}): React.ReactElement => (
            <MatrixClientContext.Provider value={client}>
                <SpaceHierarchy {...defaultProps} {...props} />
            </MatrixClientContext.Provider>
        );

        it("renders", async () => {
            const { asFragment } = render(getComponent());
            // Wait for spinners to go away
            await waitForElementToBeRemoved(screen.getAllByRole("progressbar"));
            expect(asFragment()).toMatchSnapshot();
        });

        it("should join subspace when joining nested room", async () => {
            mocked(client.joinRoom).mockResolvedValue({} as Room);

            const { getByText } = render(getComponent());
            // Wait for spinners to go away
            await waitForElementToBeRemoved(screen.getAllByRole("progressbar"));
            const button = getByText("Nested room")!.closest("li")!.querySelector(".mx_AccessibleButton_kind_primary")!;
            fireEvent.click(button);

            await waitFor(() => {
                expect(client.joinRoom).toHaveBeenCalledTimes(2);
            });
            // Joins subspace
            expect(client.joinRoom).toHaveBeenCalledWith(space1.roomId, expect.any(Object));
            expect(client.joinRoom).toHaveBeenCalledWith(room3.roomId, expect.any(Object));
        });

        it("should take user to view room for unjoined knockable rooms", async () => {
            jest.spyOn(dispatcher, "dispatch");

            const { getByText } = render(getComponent());
            // Wait for spinners to go away
            await waitForElementToBeRemoved(screen.getAllByRole("progressbar"));
            const button = getByText("Knock room")!
                .closest("li")!
                .querySelector(".mx_AccessibleButton_kind_primary_outline")!;
            fireEvent.click(button);

            expect(defaultProps.showRoom).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                hierarchyKnockRoom1.room_id,
                undefined,
            );
        });
    });
});
