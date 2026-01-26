/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent, type Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import {
    ReactionsRowButtonTooltipViewModel,
    type ReactionsRowButtonTooltipViewModelProps,
} from "../../../src/viewmodels/message-body/ReactionsRowButtonTooltipViewModel";
import { stubClient, mkStubRoom, mkEvent } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { unicodeToShortcode } from "../../../src/HtmlUtils";

jest.mock("../../../src/HtmlUtils", () => ({
    ...jest.requireActual("../../../src/HtmlUtils"),
    unicodeToShortcode: jest.fn(),
}));

const mockedUnicodeToShortcode = jest.mocked(unicodeToShortcode);

describe("ReactionsRowButtonTooltipViewModel", () => {
    let client: ReturnType<typeof stubClient>;
    let room: Room;
    let mxEvent: MatrixEvent;

    const createReactionEvent = (senderId: string, content?: Record<string, unknown>): MatrixEvent => {
        return mkEvent({
            event: true,
            type: "m.reaction",
            room: room.roomId,
            user: senderId,
            content: {
                "m.relates_to": { rel_type: "m.annotation", event_id: mxEvent.getId(), key: "👍" },
                ...content,
            },
        });
    };

    const createProps = (
        overrides?: Partial<ReactionsRowButtonTooltipViewModelProps>,
    ): ReactionsRowButtonTooltipViewModelProps => ({
        mxEvent,
        content: "👍",
        reactionEvents: [],
        customReactionImagesEnabled: false,
        ...overrides,
    });

    beforeEach(() => {
        client = stubClient();
        room = mkStubRoom("!room:example.org", "Test Room", client);
        jest.spyOn(client, "getRoom").mockReturnValue(room);

        mxEvent = mkEvent({
            event: true,
            type: "m.room.message",
            room: room.roomId,
            user: "@sender:example.org",
            content: { body: "Test message", msgtype: "m.text" },
        });

        mockedUnicodeToShortcode.mockImplementation((char: string) => {
            if (char === "👍") return ":thumbsup:";
            return "";
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        mockedUnicodeToShortcode.mockReset();
    });

    it("should return undefined snapshot when room is not found", () => {
        jest.spyOn(client, "getRoom").mockReturnValue(null);

        const vm = new ReactionsRowButtonTooltipViewModel(createProps());
        const snapshot = vm.getSnapshot();

        expect(snapshot.formattedSenders).toBeUndefined();
        expect(snapshot.caption).toBeUndefined();
    });

    it("should return undefined snapshot when MatrixClient is unavailable", () => {
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(null);

        const vm = new ReactionsRowButtonTooltipViewModel(createProps());
        const snapshot = vm.getSnapshot();

        expect(snapshot.formattedSenders).toBeUndefined();
        expect(snapshot.caption).toBeUndefined();
    });

    it("should compute formattedSenders and caption from reaction events", () => {
        const reactionEvent = createReactionEvent("@alice:example.org");
        jest.spyOn(room, "getMember").mockReturnValue({ name: "Alice", userId: "@alice:example.org" } as RoomMember);

        const vm = new ReactionsRowButtonTooltipViewModel(createProps({ reactionEvents: [reactionEvent] }));
        const snapshot = vm.getSnapshot();

        expect(snapshot.formattedSenders).toBe("Alice");
        expect(snapshot.caption).toContain(":thumbsup:");
    });

    it("should fall back to sender ID when member is not found", () => {
        const reactionEvent = createReactionEvent("@unknown:example.org");
        jest.spyOn(room, "getMember").mockReturnValue(null);

        const vm = new ReactionsRowButtonTooltipViewModel(createProps({ reactionEvents: [reactionEvent] }));

        expect(vm.getSnapshot().formattedSenders).toBe("@unknown:example.org");
    });

    it("should use custom reaction shortcode when customReactionImagesEnabled is true", () => {
        mockedUnicodeToShortcode.mockReturnValue("");
        const reactionEvent = createReactionEvent("@alice:example.org", {
            "com.beeper.reaction.shortcode": "custom_emoji",
        });
        jest.spyOn(room, "getMember").mockReturnValue({ name: "Alice", userId: "@alice:example.org" } as RoomMember);

        const vm = new ReactionsRowButtonTooltipViewModel(
            createProps({
                content: "mxc://custom/emoji",
                reactionEvents: [reactionEvent],
                customReactionImagesEnabled: true,
            }),
        );

        expect(vm.getSnapshot().caption).toContain("custom_emoji");
    });

    it("should not use custom reaction shortcode when customReactionImagesEnabled is false", () => {
        mockedUnicodeToShortcode.mockReturnValue("");
        const reactionEvent = createReactionEvent("@alice:example.org", {
            "com.beeper.reaction.shortcode": "custom_emoji",
        });
        jest.spyOn(room, "getMember").mockReturnValue({ name: "Alice", userId: "@alice:example.org" } as RoomMember);

        const vm = new ReactionsRowButtonTooltipViewModel(
            createProps({
                content: "mxc://custom/emoji",
                reactionEvents: [reactionEvent],
                customReactionImagesEnabled: false,
            }),
        );

        expect(vm.getSnapshot().caption).toBeUndefined();
    });

    it("should update snapshot and notify subscribers when setProps is called", () => {
        const aliceReaction = createReactionEvent("@alice:example.org");
        const bobReaction = createReactionEvent("@bob:example.org");

        jest.spyOn(room, "getMember").mockImplementation((userId) => {
            const names: Record<string, string> = { "@alice:example.org": "Alice", "@bob:example.org": "Bob" };
            return names[userId!] ? ({ name: names[userId!], userId } as RoomMember) : null;
        });

        const vm = new ReactionsRowButtonTooltipViewModel(createProps({ reactionEvents: [aliceReaction] }));
        expect(vm.getSnapshot().formattedSenders).toBe("Alice");

        const subscriber = jest.fn();
        vm.subscribe(subscriber);

        vm.setProps({ reactionEvents: [aliceReaction, bobReaction] });

        expect(subscriber).toHaveBeenCalled();
        expect(vm.getSnapshot().formattedSenders).toContain("Alice");
        expect(vm.getSnapshot().formattedSenders).toContain("Bob");
    });
});
