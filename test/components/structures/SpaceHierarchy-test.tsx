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

import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomHierarchy } from "matrix-js-sdk/src/room-hierarchy";
import { IHierarchyRoom } from "matrix-js-sdk/src/@types/spaces";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { mkStubRoom, stubClient } from "../../test-utils";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { showRoom, toLocalRoom } from "../../../src/components/structures/SpaceHierarchy";
import { Action } from "../../../src/dispatcher/actions";

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
        let client: MatrixClient;
        let roomV1: Room;
        let roomV2: Room;
        let roomV3: Room;

        beforeEach(() => {
            stubClient();
            client = MatrixClientPeg.get();
            roomV1 = mkStubRoom("room-id-1", "Room V1", client);
            roomV2 = mkStubRoom("room-id-2", "Room V2", client);
            roomV3 = mkStubRoom("room-id-3", "Room V3", client);
            jest.spyOn(client, "getRoomUpgradeHistory").mockReturnValue([roomV1, roomV2, roomV3]);
        });

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
    });
});
