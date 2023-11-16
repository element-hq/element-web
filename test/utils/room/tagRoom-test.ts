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

import RoomListActions from "../../../src/actions/RoomListActions";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { DefaultTagID, TagID } from "../../../src/stores/room-list/models";
import RoomListStore from "../../../src/stores/room-list/RoomListStore";
import { tagRoom } from "../../../src/utils/room/tagRoom";
import { getMockClientWithEventEmitter } from "../../test-utils";

describe("tagRoom()", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";

    const makeRoom = (tags: TagID[] = []): Room => {
        const client = getMockClientWithEventEmitter({
            isGuest: jest.fn(),
        });
        const room = new Room(roomId, client, userId);

        jest.spyOn(RoomListStore.instance, "getTagsForRoom").mockReturnValue(tags);

        return room;
    };

    beforeEach(() => {
        // stub
        jest.spyOn(defaultDispatcher, "dispatch").mockImplementation(() => {});
        jest.spyOn(RoomListActions, "tagRoom").mockReturnValue({ action: "mocked_tag_room_action", fn: () => {} });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("does nothing when room tag is not allowed", () => {
        const room = makeRoom();

        tagRoom(room, DefaultTagID.ServerNotice);

        expect(defaultDispatcher.dispatch).not.toHaveBeenCalled();
        expect(RoomListActions.tagRoom).not.toHaveBeenCalled();
    });

    describe("when a room has no tags", () => {
        it("should tag a room as favourite", () => {
            const room = makeRoom();

            tagRoom(room, DefaultTagID.Favourite);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                DefaultTagID.LowPriority, // remove
                DefaultTagID.Favourite, // add
                0,
            );
        });

        it("should tag a room low priority", () => {
            const room = makeRoom();

            tagRoom(room, DefaultTagID.LowPriority);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                DefaultTagID.Favourite, // remove
                DefaultTagID.LowPriority, // add
                0,
            );
        });
    });

    describe("when a room is tagged as favourite", () => {
        it("should unfavourite a room", () => {
            const room = makeRoom([DefaultTagID.Favourite]);

            tagRoom(room, DefaultTagID.Favourite);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                DefaultTagID.Favourite, // remove
                null, // add
                0,
            );
        });

        it("should tag a room low priority", () => {
            const room = makeRoom([DefaultTagID.Favourite]);

            tagRoom(room, DefaultTagID.LowPriority);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                DefaultTagID.Favourite, // remove
                DefaultTagID.LowPriority, // add
                0,
            );
        });
    });
    describe("when a room is tagged as low priority", () => {
        it("should favourite a room", () => {
            const room = makeRoom([DefaultTagID.LowPriority]);

            tagRoom(room, DefaultTagID.Favourite);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                DefaultTagID.LowPriority, // remove
                DefaultTagID.Favourite, // add
                0,
            );
        });

        it("should untag a room low priority", () => {
            const room = makeRoom([DefaultTagID.LowPriority]);

            tagRoom(room, DefaultTagID.LowPriority);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                DefaultTagID.LowPriority, // remove
                null, // add
                0,
            );
        });
    });
});
