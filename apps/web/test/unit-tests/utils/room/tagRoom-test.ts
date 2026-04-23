/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "matrix-js-sdk/src/matrix";

import RoomListActions from "../../../../src/actions/RoomListActions";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { DefaultTagID, type TagID } from "../../../../src/stores/room-list-v3/skip-list/tag";
import { CUSTOM_SECTION_TAG_PREFIX } from "../../../../src/stores/room-list-v3/section";
import { tagRoom } from "../../../../src/utils/room/tagRoom";
import { getMockClientWithEventEmitter } from "../../../test-utils";
import * as getTagsForRoomUtils from "../../../../src/utils/room/getTagsForRoom";

describe("tagRoom()", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const customTag = `${CUSTOM_SECTION_TAG_PREFIX}my-section`;

    const makeRoom = (tags: TagID[] = []): Room => {
        const client = getMockClientWithEventEmitter({
            isGuest: jest.fn(),
        });
        const room = new Room(roomId, client, userId);

        jest.spyOn(getTagsForRoomUtils, "getTagsForRoom").mockReturnValue(tags);

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
                null, // remove
                DefaultTagID.Favourite, // add
            );
        });

        it("should tag a room low priority", () => {
            const room = makeRoom();

            tagRoom(room, DefaultTagID.LowPriority);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                null, // remove
                DefaultTagID.LowPriority, // add
            );
        });

        it("should tag a room with a custom section", () => {
            const room = makeRoom();

            tagRoom(room, customTag);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                null, // remove
                customTag, // add
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
            );
        });
    });

    describe("when a room is tagged with a custom section", () => {
        const otherCustomTag = `${CUSTOM_SECTION_TAG_PREFIX}other-section`;

        it.each([
            { label: "untag the custom section", applyTag: customTag, expectedAdd: null },
            { label: "replace with favourite", applyTag: DefaultTagID.Favourite, expectedAdd: DefaultTagID.Favourite },
            { label: "replace with another custom section", applyTag: otherCustomTag, expectedAdd: otherCustomTag },
        ])("should $label", ({ applyTag, expectedAdd }) => {
            const room = makeRoom([customTag]);

            tagRoom(room, applyTag);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                customTag, // remove
                expectedAdd, // add
            );
        });
    });
});
