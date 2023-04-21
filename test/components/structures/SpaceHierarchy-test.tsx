/*
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
import { mocked } from "jest-mock";
import { render } from "@testing-library/react";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomHierarchy } from "matrix-js-sdk/src/room-hierarchy";
import { IHierarchyRoom } from "matrix-js-sdk/src/@types/spaces";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { mkStubRoom, stubClient } from "../../test-utils";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { HierarchyLevel, showRoom, toLocalRoom } from "../../../src/components/structures/SpaceHierarchy";
import { Action } from "../../../src/dispatcher/actions";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import SettingsStore from "../../../src/settings/SettingsStore";

// Fake random strings to give a predictable snapshot for checkbox IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

describe("SpaceHierarchy", () => {
    describe("showRoom", () => {
        let client: MatrixClient;
        let hierarchy: RoomHierarchy;
        let room: Room;
        beforeEach(() => {
            stubClient();
            client = MatrixClientPeg.get();
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
        const client = MatrixClientPeg.get();
        const roomV1 = mkStubRoom("room-id-1", "Room V1", client);
        const roomV2 = mkStubRoom("room-id-2", "Room V2", client);
        const roomV3 = mkStubRoom("room-id-3", "Room V3", client);
        jest.spyOn(client, "getRoomUpgradeHistory").mockReturnValue([roomV1, roomV2, roomV3]);

        it("grabs last room that is in hierarchy when latest version is in hierarchy", () => {
            const hierarchy = {
                roomMap: new Map([
                    [roomV1.roomId, { room_id: roomV1.roomId } as IHierarchyRoom],
                    [roomV2.roomId, { room_id: roomV2.roomId } as IHierarchyRoom],
                    [roomV3.roomId, { room_id: roomV3.roomId } as IHierarchyRoom],
                ]),
            } as RoomHierarchy;
            const localRoomV1 = toLocalRoom(client, { room_id: roomV1.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV1.room_id).toEqual(roomV3.roomId);
            const localRoomV2 = toLocalRoom(client, { room_id: roomV2.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV2.room_id).toEqual(roomV3.roomId);
            const localRoomV3 = toLocalRoom(client, { room_id: roomV3.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV3.room_id).toEqual(roomV3.roomId);
        });

        it("grabs last room that is in hierarchy when latest version is *not* in hierarchy", () => {
            const hierarchy = {
                roomMap: new Map([
                    [roomV1.roomId, { room_id: roomV1.roomId } as IHierarchyRoom],
                    [roomV2.roomId, { room_id: roomV2.roomId } as IHierarchyRoom],
                ]),
            } as RoomHierarchy;
            const localRoomV1 = toLocalRoom(client, { room_id: roomV1.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV1.room_id).toEqual(roomV2.roomId);
            const localRoomV2 = toLocalRoom(client, { room_id: roomV2.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV2.room_id).toEqual(roomV2.roomId);
            const localRoomV3 = toLocalRoom(client, { room_id: roomV3.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV3.room_id).toEqual(roomV2.roomId);
        });

        it("returns specified room when none of the versions is in hierarchy", () => {
            const hierarchy = { roomMap: new Map([]) } as RoomHierarchy;
            const localRoomV1 = toLocalRoom(client, { room_id: roomV1.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV1.room_id).toEqual(roomV1.roomId);
            const localRoomV2 = toLocalRoom(client, { room_id: roomV2.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV2.room_id).toEqual(roomV2.roomId);
            const localRoomV3 = toLocalRoom(client, { room_id: roomV3.roomId } as IHierarchyRoom, hierarchy);
            expect(localRoomV3.room_id).toEqual(roomV3.roomId);
        });

        describe("If the feature_dynamic_room_predecessors is not enabled", () => {
            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
            });
            it("Passes through the dynamic predecessor setting", async () => {
                mocked(client.getRoomUpgradeHistory).mockClear();
                const hierarchy = { roomMap: new Map([]) } as RoomHierarchy;
                toLocalRoom(client, { room_id: roomV1.roomId } as IHierarchyRoom, hierarchy);
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
                toLocalRoom(client, { room_id: roomV1.roomId } as IHierarchyRoom, hierarchy);
                expect(client.getRoomUpgradeHistory).toHaveBeenCalledWith(roomV1.roomId, true, true);
            });
        });
    });

    describe("<HierarchyLevel />", () => {
        stubClient();
        const client = MatrixClientPeg.get();

        const dmRoomMap = {
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);

        const root = mkStubRoom("room-id-1", "Room 1", client);
        const room1 = mkStubRoom("room-id-2", "Room 2", client);
        const room2 = mkStubRoom("room-id-3", "Room 3", client);

        const hierarchyRoot = {
            room_id: root.roomId,
            num_joined_members: 1,
            children_state: [
                {
                    state_key: room1.roomId,
                    content: { order: "1" },
                },
                {
                    state_key: room2.roomId,
                    content: { order: "2" },
                },
            ],
        } as IHierarchyRoom;
        const hierarchyRoom1 = { room_id: room1.roomId, num_joined_members: 2 } as IHierarchyRoom;
        const hierarchyRoom2 = { room_id: root.roomId, num_joined_members: 3 } as IHierarchyRoom;

        const roomHierarchy = {
            roomMap: new Map([
                [root.roomId, hierarchyRoot],
                [room1.roomId, hierarchyRoom1],
                [room2.roomId, hierarchyRoom2],
            ]),
            isSuggested: jest.fn(),
        } as unknown as RoomHierarchy;

        it("renders", () => {
            const defaultProps = {
                root: hierarchyRoot,
                roomSet: new Set([hierarchyRoom1, hierarchyRoom2]),
                hierarchy: roomHierarchy,
                parents: new Set<string>(),
                selectedMap: new Map<string, Set<string>>(),
                onViewRoomClick: jest.fn(),
                onJoinRoomClick: jest.fn(),
                onToggleClick: jest.fn(),
            };
            const getComponent = (props = {}): React.ReactElement => (
                <MatrixClientContext.Provider value={client}>
                    <HierarchyLevel {...defaultProps} {...props} />;
                </MatrixClientContext.Provider>
            );

            const { container } = render(getComponent());
            expect(container).toMatchSnapshot();
        });
    });
});
