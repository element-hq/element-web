/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../test-utils";
import { DateSeparatorViewModel } from "../../../src/viewmodels/room/timeline/DateSeparatorViewModel";
import { TimelinePanelPresenter } from "../../../src/viewmodels/room/timeline/TimelinePanelPresenter";

jest.mock("../../../src/utils/DMRoomMap", () => ({
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
    const client = {} as any;

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

    function makePresenter(canPaginateBackward: boolean): TimelinePanelPresenter {
        return new TimelinePanelPresenter({
            client,
            room,
            canPaginateBackward: () => canPaginateBackward,
        });
    }

    it("does not insert a date separator before the first event when the timeline can paginate backward", () => {
        const presenter = makePresenter(true);

        expect(presenter.buildItems([eventA])).toEqual([{ key: eventA.getId()!, kind: "event" }]);
    });

    it("matches legacy creation ordering at the start of history", () => {
        const presenter = makePresenter(false);

        const items = presenter.buildItems([createEvent, encryptionEvent, topicEvent]);
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
        const presenter = makePresenter(true);

        const items = presenter.buildItems([eventA, eventB]);
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
});
