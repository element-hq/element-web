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

import { Room } from "matrix-js-sdk/src/matrix";

import { LocalRoom, LOCAL_ROOM_ID_PREFIX } from "../../../src/models/LocalRoom";
import { isLocalRoom } from "../../../src/utils/localRoom/isLocalRoom";
import { createTestClient } from "../../test-utils";

describe("isLocalRoom", () => {
    let room: Room;
    let localRoom: LocalRoom;

    beforeEach(() => {
        const client = createTestClient();
        room = new Room("!room:example.com", client, client.getUserId()!);
        localRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", client, client.getUserId()!);
    });

    it("should return false for a Room", () => {
        expect(isLocalRoom(room)).toBe(false);
    });

    it("should return false for a non-local room ID", () => {
        expect(isLocalRoom(room.roomId)).toBe(false);
    });

    it("should return true for LocalRoom", () => {
        expect(isLocalRoom(localRoom)).toBe(true);
    });

    it("should return true for local room ID", () => {
        expect(isLocalRoom(LOCAL_ROOM_ID_PREFIX + "test")).toBe(true);
    });
});
