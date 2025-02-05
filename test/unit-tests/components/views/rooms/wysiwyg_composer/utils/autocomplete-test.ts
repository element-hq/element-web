/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import React from "react";

import { type ICompletion } from "../../../../../../../src/autocomplete/Autocompleter";
import {
    buildQuery,
    getRoomFromCompletion,
    getMentionDisplayText,
    getMentionAttributes,
} from "../../../../../../../src/components/views/rooms/wysiwyg_composer/utils/autocomplete";
import { createTestClient, mkRoom } from "../../../../../../test-utils";
import * as _mockAvatar from "../../../../../../../src/Avatar";

const mockClient = createTestClient();
const mockRoomId = "mockRoomId";
const mockRoom = mkRoom(mockClient, mockRoomId);

const createMockCompletion = (props: Partial<ICompletion>): ICompletion => {
    return {
        completion: "mock",
        range: { beginning: true, start: 0, end: 0 },
        component: React.createElement("div"),
        ...props,
    };
};

jest.mock("../../../../../../../src/Avatar");
jest.mock("../../../../../../../src/stores/WidgetStore");
jest.mock("../../../../../../../src/stores/widgets/WidgetLayoutStore");

beforeEach(() => jest.clearAllMocks());
afterAll(() => jest.restoreAllMocks());

describe("buildQuery", () => {
    it("returns an empty string for a falsy argument", () => {
        expect(buildQuery(null)).toBe("");
    });

    it("returns an empty string when keyChar is falsy", () => {
        const noKeyCharSuggestion = { keyChar: "" as const, text: "test", type: "unknown" as const };
        expect(buildQuery(noKeyCharSuggestion)).toBe("");
    });

    it("combines the keyChar and text of the suggestion in the query", () => {
        const handledSuggestion = { keyChar: "@" as const, text: "alice", type: "mention" as const };
        expect(buildQuery(handledSuggestion)).toBe("@alice");

        const handledCommand = { keyChar: "/" as const, text: "spoiler", type: "mention" as const };
        expect(buildQuery(handledCommand)).toBe("/spoiler");
    });
});

describe("getRoomFromCompletion", () => {
    const createMockRoomCompletion = (props: Partial<ICompletion>): ICompletion => {
        return createMockCompletion({ ...props, type: "room" });
    };

    it("calls getRoom with completionId if present in the completion", () => {
        const testId = "arbitraryId";
        const completionWithId = createMockRoomCompletion({ completionId: testId });

        getRoomFromCompletion(completionWithId, mockClient);

        expect(mockClient.getRoom).toHaveBeenCalledWith(testId);
    });

    it("calls getRoom with completion if present and correct format", () => {
        const testCompletion = "arbitraryCompletion";
        const completionWithId = createMockRoomCompletion({ completionId: testCompletion });

        getRoomFromCompletion(completionWithId, mockClient);

        expect(mockClient.getRoom).toHaveBeenCalledWith(testCompletion);
    });

    it("calls getRooms if no completionId is present and completion starts with #", () => {
        const completionWithId = createMockRoomCompletion({ completion: "#hash" });

        const result = getRoomFromCompletion(completionWithId, mockClient);

        expect(mockClient.getRoom).not.toHaveBeenCalled();
        expect(mockClient.getRooms).toHaveBeenCalled();

        // in this case, because the mock client returns an empty array of rooms
        // from the call to get rooms, we'd expect the result to be null
        expect(result).toBe(null);
    });
});

describe("getMentionDisplayText", () => {
    it("returns an empty string if we are not handling a user, room or at-room type", () => {
        const nonHandledCompletionTypes = ["community", "command"] as const;
        const nonHandledCompletions = nonHandledCompletionTypes.map((type) => createMockCompletion({ type }));

        nonHandledCompletions.forEach((completion) => {
            expect(getMentionDisplayText(completion, mockClient)).toBe("");
        });
    });

    it("returns the completion if we are handling a user", () => {
        const testCompletion = "display this";
        const userCompletion = createMockCompletion({ type: "user", completion: testCompletion });

        expect(getMentionDisplayText(userCompletion, mockClient)).toBe(testCompletion);
    });

    it("returns the room name when the room has a valid completionId", () => {
        const testCompletionId = "testId";
        const userCompletion = createMockCompletion({ type: "room", completionId: testCompletionId });

        // as this uses the mockClient, the name will be the mock room name returned from there
        expect(getMentionDisplayText(userCompletion, mockClient)).toBe(mockClient.getRoom("")?.name);
    });

    it("falls back to the completion for a room if completion starts with #", () => {
        const testCompletion = "#hash";
        const userCompletion = createMockCompletion({ type: "room", completion: testCompletion });

        // as this uses the mockClient, the name will be the mock room name returned from there
        expect(getMentionDisplayText(userCompletion, mockClient)).toBe(testCompletion);
    });

    it("returns the completion if we are handling an at-room completion", () => {
        const testCompletion = "display this";
        const atRoomCompletion = createMockCompletion({ type: "at-room", completion: testCompletion });

        expect(getMentionDisplayText(atRoomCompletion, mockClient)).toBe(testCompletion);
    });
});

describe("getMentionAttributes", () => {
    it("returns an empty map for completion types other than room, user or at-room", () => {
        const nonHandledCompletionTypes = ["community", "command"] as const;
        const nonHandledCompletions = nonHandledCompletionTypes.map((type) => createMockCompletion({ type }));

        nonHandledCompletions.forEach((completion) => {
            expect(getMentionAttributes(completion, mockClient, mockRoom)).toEqual(new Map());
        });
    });

    const testAvatarUrlForString = "www.stringUrl.com";
    const testAvatarUrlForMember = "www.memberUrl.com";
    const testAvatarUrlForRoom = "www.roomUrl.com";
    const testInitialLetter = "z";

    const mockAvatar = mocked(_mockAvatar);
    mockAvatar.defaultAvatarUrlForString.mockReturnValue(testAvatarUrlForString);
    mockAvatar.avatarUrlForMember.mockReturnValue(testAvatarUrlForMember);
    mockAvatar.avatarUrlForRoom.mockReturnValue(testAvatarUrlForRoom);
    mockAvatar.getInitialLetter.mockReturnValue(testInitialLetter);

    describe("user mentions", () => {
        it("returns an empty map when no member can be found", () => {
            const userCompletion = createMockCompletion({ type: "user" });

            // mock not being able to find a member
            mockRoom.getMember.mockImplementationOnce(() => null);

            const result = getMentionAttributes(userCompletion, mockClient, mockRoom);
            expect(result).toEqual(new Map());
        });

        it("returns expected attributes when avatar url is not default", () => {
            const userCompletion = createMockCompletion({ type: "user" });

            const result = getMentionAttributes(userCompletion, mockClient, mockRoom);

            expect(result).toEqual(
                new Map([
                    ["data-mention-type", "user"],
                    ["style", `--avatar-background: url(${testAvatarUrlForMember}); --avatar-letter: '\u200b'`],
                ]),
            );
        });

        it("returns expected style attributes when avatar url matches default", () => {
            const userCompletion = createMockCompletion({ type: "user" });

            // mock a single implementation of avatarUrlForMember to make it match the default
            mockAvatar.avatarUrlForMember.mockReturnValueOnce(testAvatarUrlForString);

            const result = getMentionAttributes(userCompletion, mockClient, mockRoom);

            expect(result).toEqual(
                new Map([
                    ["data-mention-type", "user"],
                    [
                        "style",
                        `--avatar-background: url(${testAvatarUrlForString}); --avatar-letter: '${testInitialLetter}'`,
                    ],
                ]),
            );
        });
    });

    describe("room mentions", () => {
        it("returns expected attributes when avatar url for room is truthy", () => {
            const userCompletion = createMockCompletion({ type: "room" });

            const result = getMentionAttributes(userCompletion, mockClient, mockRoom);

            expect(result).toEqual(
                new Map([
                    ["data-mention-type", "room"],
                    ["style", `--avatar-background: url(${testAvatarUrlForRoom}); --avatar-letter: '\u200b'`],
                ]),
            );
        });

        it("returns expected style attributes when avatar url for room is falsy", () => {
            const userCompletion = createMockCompletion({ type: "room" });

            // mock a single implementation of avatarUrlForRoom to make it falsy
            mockAvatar.avatarUrlForRoom.mockReturnValueOnce(null);

            const result = getMentionAttributes(userCompletion, mockClient, mockRoom);

            expect(result).toEqual(
                new Map([
                    ["data-mention-type", "room"],
                    [
                        "style",
                        `--avatar-background: url(${testAvatarUrlForString}); --avatar-letter: '${testInitialLetter}'`,
                    ],
                ]),
            );
        });
    });

    describe("at-room mentions", () => {
        it("returns expected attributes when avatar url for room is truthyf", () => {
            const atRoomCompletion = createMockCompletion({ type: "at-room" });

            const result = getMentionAttributes(atRoomCompletion, mockClient, mockRoom);

            expect(result).toEqual(
                new Map([
                    ["data-mention-type", "at-room"],
                    ["style", `--avatar-background: url(${testAvatarUrlForRoom}); --avatar-letter: '\u200b'`],
                ]),
            );
        });

        it("returns expected style attributes when avatar url for room is falsy", () => {
            const atRoomCompletion = createMockCompletion({ type: "at-room" });

            // mock a single implementation of avatarUrlForRoom to make it falsy
            mockAvatar.avatarUrlForRoom.mockReturnValueOnce(null);

            const result = getMentionAttributes(atRoomCompletion, mockClient, mockRoom);

            expect(result).toEqual(
                new Map([
                    ["data-mention-type", "at-room"],
                    [
                        "style",
                        `--avatar-background: url(${testAvatarUrlForString}); --avatar-letter: '${testInitialLetter}'`,
                    ],
                ]),
            );
        });
    });
});
