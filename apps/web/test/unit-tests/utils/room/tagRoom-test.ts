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
import { CHATS_TAG } from "../../../../src/stores/room-list-v3/RoomListStoreV3";
import { tagRoom } from "../../../../src/utils/room/tagRoom";
import { getMockClientWithEventEmitter } from "../../../test-utils";
import * as getSectionTagForRoomUtils from "../../../../src/utils/room/getSectionTagForRoom";

describe("tagRoom()", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const customTag = `${CUSTOM_SECTION_TAG_PREFIX}my-section`;

    const makeRoom = (currentSectionTag: TagID | null = null): Room => {
        const client = getMockClientWithEventEmitter({
            isGuest: jest.fn(),
        });
        const room = new Room(roomId, client, userId);

        jest.spyOn(getSectionTagForRoomUtils, "getSectionTagForRoom").mockReturnValue(currentSectionTag);

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

    describe("when a room has no section tag", () => {
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

        it("should do nothing meaningful when applying CHATS_TAG", () => {
            const room = makeRoom();

            tagRoom(room, CHATS_TAG);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                null, // remove
                null, // add
            );
        });
    });

    describe("when a room is tagged as favourite", () => {
        it("should unfavourite a room", () => {
            const room = makeRoom(DefaultTagID.Favourite);

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
            const room = makeRoom(DefaultTagID.Favourite);

            tagRoom(room, DefaultTagID.LowPriority);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                DefaultTagID.Favourite, // remove
                DefaultTagID.LowPriority, // add
            );
        });

        it("should remove the favourite tag when applying CHATS_TAG", () => {
            const room = makeRoom(DefaultTagID.Favourite);

            tagRoom(room, CHATS_TAG);

            expect(defaultDispatcher.dispatch).toHaveBeenCalled();
            expect(RoomListActions.tagRoom).toHaveBeenCalledWith(
                room.client,
                room,
                DefaultTagID.Favourite, // remove
                null, // add
            );
        });
    });

    describe("when a room is tagged as low priority", () => {
        it("should favourite a room", () => {
            const room = makeRoom(DefaultTagID.LowPriority);

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
            const room = makeRoom(DefaultTagID.LowPriority);

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
            { label: "remove section tag when applying CHATS_TAG", applyTag: CHATS_TAG, expectedAdd: null },
        ])("should $label", ({ applyTag, expectedAdd }) => {
            const room = makeRoom(customTag);

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
