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

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { stubClient } from "../../test-utils";
import dispatcher from "../../../src/dispatcher/dispatcher";
import { showRoom } from "../../../src/components/structures/SpaceHierarchy";
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
                "action": Action.ViewRoom,
                "should_peek": true,
                "room_alias": "canonical-alias",
                "room_id": "room-id2",
                "via_servers": [],
                "oob_data": {
                    avatarUrl: undefined,
                    name: "canonical-alias",
                },
                "roomType": undefined,
                "metricsTrigger": "RoomDirectory",
            });
        });
    });
});
