/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../../../../../test-utils";
import { DateSeparatorViewModel } from "../../../../../../../src/viewmodels/room/timeline/DateSeparatorViewModel";
import { TimelinePanelPresenter } from "../../../../../../../src/components/views/rooms/timeline/Timeline";

jest.mock("../../../../../../../src/utils/DMRoomMap", () => ({
    __esModule: true,
    default: {
        shared: jest.fn(() => ({
            getUserIdForRoomId: jest.fn(() => undefined),
        })),
    },
}));

describe("TimelinePanelPresenter", () => {
    const room = {
        roomId: "!room:example.org",
    } as any;

    const eventA = mkEvent({
        id: "$eventA",
        type: EventType.RoomMessage,
        room: room.roomId,
        user: "@alice:example.org",
        content: { body: "A", msgtype: "m.text" },
        ts: new Date("2026-04-08T08:00:00.000Z").getTime(),
        event: true,
    });
    const eventB = mkEvent({
        id: "$eventB",
        type: EventType.RoomMessage,
        room: room.roomId,
        user: "@alice:example.org",
        content: { body: "B", msgtype: "m.text" },
        ts: new Date("2026-04-09T08:00:00.000Z").getTime(),
        event: true,
    });
    const createEvent = mkEvent({
        id: "$create",
        type: EventType.RoomCreate,
        room: room.roomId,
        user: "@alice:example.org",
        content: { creator: "@alice:example.org" },
        ts: new Date("2026-04-08T08:00:00.000Z").getTime(),
        event: true,
    });
    const encryptionEvent = mkEvent({
        id: "$encryption",
        type: EventType.RoomEncryption,
        room: room.roomId,
        user: "@alice:example.org",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
        ts: new Date("2026-04-08T08:01:00.000Z").getTime(),
        event: true,
    });
    const topicEvent = mkEvent({
        id: "$topic",
        type: EventType.RoomTopic,
        room: room.roomId,
        user: "@alice:example.org",
        content: { topic: "hello" },
        ts: new Date("2026-04-08T08:02:00.000Z").getTime(),
        event: true,
    });

    beforeEach(() => {
        jest.clearAllMocks();
        createEvent.sender = {
            userId: "@alice:example.org",
            name: "Alice",
            getMxcAvatarUrl: jest.fn(),
        } as any;
        encryptionEvent.sender = createEvent.sender;
        topicEvent.sender = createEvent.sender;
    });

    function makePresenter(): TimelinePanelPresenter {
        return new TimelinePanelPresenter({
            room,
        });
    }

    it("does not insert a date separator before the first event when the timeline can paginate backward", () => {
        const presenter = makePresenter();

        expect(presenter.buildItems([eventA], true)).toEqual([{ key: eventA.getId()!, kind: "event" }]);
    });

    it("matches legacy creation ordering at the start of history", () => {
        const presenter = makePresenter();

        const items = presenter.buildItems([createEvent, encryptionEvent, topicEvent], false);
        expect(items).toHaveLength(4);
        expect(items[1]).toMatchObject({
            key: encryptionEvent.getId(),
            kind: "event",
        });
        expect(items[0]).toMatchObject({
            key: `date-${new Date(createEvent.getTs()).toDateString()}`,
            kind: "virtual",
            type: "date-separator",
        });
        expect(items[0]?.kind === "virtual" && items[0].type === "date-separator" && items[0].vm).toBeInstanceOf(
            DateSeparatorViewModel,
        );
        expect(items[2]).toEqual({
            key: "new-room",
            kind: "virtual",
            type: "new-room",
        });
        expect(items[3]).toMatchObject({
            kind: "group",
            type: "room-creation",
        });
        expect(items[3]?.kind === "group" && items[3].summaryText).toContain("Alice");
        expect(items[3]?.kind === "group" && items[3].events).toEqual([createEvent, topicEvent]);
    });

    it("still inserts a date separator when the day changes between loaded events", () => {
        const presenter = makePresenter();

        const items = presenter.buildItems([eventA, eventB], true);
        expect(items).toHaveLength(3);
        expect(items[0]).toEqual({ key: eventA.getId()!, kind: "event" });
        expect(items[1]).toMatchObject({
            key: `date-${new Date(eventB.getTs()).toDateString()}`,
            kind: "virtual",
            type: "date-separator",
        });
        expect(items[1]?.kind === "virtual" && items[1].type === "date-separator" && items[1].vm).toBeInstanceOf(
            DateSeparatorViewModel,
        );
        expect(items[2]).toEqual({ key: eventB.getId()!, kind: "event" });
    });

    it("adds start events on a later rebuild when backward pagination is no longer possible", () => {
        const presenter = makePresenter();

        expect(presenter.buildItems([createEvent, encryptionEvent, topicEvent], true)).toEqual([
            { key: createEvent.getId()!, kind: "event" },
            { key: encryptionEvent.getId()!, kind: "event" },
            { key: topicEvent.getId()!, kind: "event" },
        ]);

        expect(presenter.buildItems([createEvent, encryptionEvent, topicEvent], false)).toMatchObject([
            {
                key: `date-${new Date(createEvent.getTs()).toDateString()}`,
                kind: "virtual",
                type: "date-separator",
            },
            {
                key: encryptionEvent.getId(),
                kind: "event",
            },
            {
                key: "new-room",
                kind: "virtual",
                type: "new-room",
            },
            {
                kind: "group",
                type: "room-creation",
            },
        ]);
    });
});
