/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";

import { DefaultTagID } from "../../../../src/stores/room-list-v3/skip-list/tag";
import { CUSTOM_SECTION_TAG_PREFIX } from "../../../../src/stores/room-list-v3/section";
import { getSectionTagForRoom } from "../../../../src/utils/room/getSectionTagForRoom";
import { getTagsForRoom } from "../../../../src/utils/room/getTagsForRoom";

jest.mock("../../../../src/utils/room/getTagsForRoom");

const mockGetTagsForRoom = jest.mocked(getTagsForRoom);

describe("getSectionTagForRoom", () => {
    const room = {} as Room;

    it("should return null when room has no tags", () => {
        mockGetTagsForRoom.mockReturnValue([]);
        expect(getSectionTagForRoom(room)).toBeNull();
    });

    it("should return null when room only has a non-section tag", () => {
        mockGetTagsForRoom.mockReturnValue([DefaultTagID.Untagged]);
        expect(getSectionTagForRoom(room)).toBeNull();
    });

    it.each([DefaultTagID.Favourite, DefaultTagID.LowPriority, `${CUSTOM_SECTION_TAG_PREFIX}abc-123`])(
        "should return section tag %s when present",
        (tag) => {
            mockGetTagsForRoom.mockReturnValue([tag]);
            expect(getSectionTagForRoom(room)).toBe(tag);
        },
    );

    it("should return the first section tag when multiple are present", () => {
        const customTag = `${CUSTOM_SECTION_TAG_PREFIX}abc-123`;
        mockGetTagsForRoom.mockReturnValue([DefaultTagID.Favourite, customTag]);
        expect(getSectionTagForRoom(room)).toBe(DefaultTagID.Favourite);
    });

    it("should ignore non-section tags and return the section tag", () => {
        const customTag = `${CUSTOM_SECTION_TAG_PREFIX}abc-123`;
        mockGetTagsForRoom.mockReturnValue([DefaultTagID.Untagged, customTag]);
        expect(getSectionTagForRoom(room)).toBe(customTag);
    });
});
