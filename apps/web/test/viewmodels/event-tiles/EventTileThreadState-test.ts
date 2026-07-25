/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, type MatrixEvent, MsgType, type Thread } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../test-utils";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import {
    getEventTileThread,
    getEventTileThreadState,
    type EventTileThreadLookup,
    type EventTileThreadStateInput,
} from "../../../src/viewmodels/room/timeline/event-tile/EventTileThreadState";

const roomId = "!room:example.org";
const userId = "@alice:example.org";

function makeEvent({ id = "$event" }: { id?: string } = {}): MatrixEvent {
    return mkEvent({
        event: true,
        id,
        type: EventType.RoomMessage,
        room: roomId,
        user: userId,
        content: {
            msgtype: MsgType.Text,
            body: "Hello",
        },
    });
}

function makeThread({
    id = "$event",
    replyToEvent,
}: {
    id?: string;
    replyToEvent?: MatrixEvent;
} = {}): Thread {
    return {
        id,
        length: 2,
        replyToEvent,
    } as Thread;
}

function makeInput(overrides: Partial<EventTileThreadStateInput> = {}): EventTileThreadStateInput {
    return {
        mxEvent: makeEvent(),
        thread: null,
        timelineRenderingType: TimelineRenderingType.Room,
        ...overrides,
    };
}

function setThreadRootId(mxEvent: MatrixEvent, threadRootId: string): void {
    Object.defineProperty(mxEvent, "threadRootId", {
        configurable: true,
        value: threadRootId,
    });
}

describe("EventTileThreadState", () => {
    it("uses the event thread when it is already available", () => {
        const mxEvent = makeEvent();
        const thread = makeThread();
        jest.spyOn(mxEvent, "getThread").mockReturnValue(thread);
        const room: EventTileThreadLookup = {
            findThreadForEvent: jest.fn(),
        };

        expect(getEventTileThread(mxEvent, room)).toBe(thread);
        expect(room.findThreadForEvent).not.toHaveBeenCalled();
    });

    it("falls back to the room thread lookup", () => {
        const mxEvent = makeEvent();
        const thread = makeThread();
        jest.spyOn(mxEvent, "getThread").mockReturnValue(undefined);
        const room: EventTileThreadLookup = {
            findThreadForEvent: jest.fn().mockReturnValue(thread),
        };

        expect(getEventTileThread(mxEvent, room)).toBe(thread);
        expect(room.findThreadForEvent).toHaveBeenCalledWith(mxEvent);
    });

    it("returns null when no thread can be found", () => {
        const mxEvent = makeEvent();
        jest.spyOn(mxEvent, "getThread").mockReturnValue(undefined);

        expect(getEventTileThread(mxEvent, null)).toBeNull();
    });

    it("shows the thread summary for thread root events", () => {
        const mxEvent = makeEvent({ id: "$thread-root" });
        const thread = makeThread({ id: "$thread-root" });

        const state = getEventTileThreadState(makeInput({ mxEvent, thread }));

        expect(state.shouldShowThreadSummary).toBe(true);
        expect(state.shouldShowThreadPanelSummary).toBe(true);
        expect(state.searchThreadInfo.kind).toBe("none");
    });

    it("derives the thread panel timestamp from the latest reply", () => {
        const replyToEvent = makeEvent({ id: "$reply" });
        jest.spyOn(replyToEvent, "getTs").mockReturnValue(123);

        const state = getEventTileThreadState(
            makeInput({
                thread: makeThread({ replyToEvent }),
            }),
        );

        expect(state.threadReplyEventTs).toBe(123);
    });

    it("shows linked search thread info for thread replies with a highlight link", () => {
        const mxEvent = makeEvent();
        setThreadRootId(mxEvent, "$thread-root");

        const state = getEventTileThreadState(
            makeInput({
                mxEvent,
                timelineRenderingType: TimelineRenderingType.Search,
                highlightLink: "https://example.org/thread",
            }),
        );

        expect(state.searchThreadInfo).toEqual({
            kind: "link",
            href: "https://example.org/thread",
        });
    });

    it("shows text search thread info for thread replies without a highlight link", () => {
        const mxEvent = makeEvent();
        setThreadRootId(mxEvent, "$thread-root");

        const state = getEventTileThreadState(
            makeInput({
                mxEvent,
                timelineRenderingType: TimelineRenderingType.Search,
            }),
        );

        expect(state.searchThreadInfo).toEqual({
            kind: "text",
        });
    });

    it("does not show search thread info outside search timelines", () => {
        const mxEvent = makeEvent();
        setThreadRootId(mxEvent, "$thread-root");

        const state = getEventTileThreadState(makeInput({ mxEvent }));

        expect(state.searchThreadInfo.kind).toBe("none");
    });
});
