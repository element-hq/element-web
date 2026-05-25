/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventEmitter } from "events";
import { type MouseEvent } from "react";
import {
    EventType,
    type MatrixClient,
    type MatrixEvent,
    MsgType,
    type Room,
    RoomEvent,
    type RoomMember,
    type Thread,
    ThreadEvent,
} from "matrix-js-sdk/src/matrix";
import { waitFor } from "jest-matrix-react";

import { mkEvent } from "../../test-utils";
import { NotificationLevel } from "../../../src/stores/notifications/NotificationLevel";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { MessagePreviewStore } from "../../../src/stores/message-preview";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import PosthogTrackers from "../../../src/PosthogTrackers";
import { determineUnreadState } from "../../../src/RoomNotifs";
import {
    ThreadMessagePreviewViewModel,
    ThreadSummaryViewModel,
    type ThreadSummaryViewModelProps,
} from "../../../src/viewmodels/room/timeline/event-tile/ThreadSummaryViewModel";

jest.mock("../../../src/dispatcher/dispatcher", () => ({
    __esModule: true,
    default: {
        dispatch: jest.fn(),
        register: jest.fn(),
        unregister: jest.fn(),
    },
}));

jest.mock("../../../src/PosthogTrackers", () => ({
    __esModule: true,
    default: {
        trackInteraction: jest.fn(),
    },
}));

jest.mock("../../../src/RoomNotifs", () => ({
    determineUnreadState: jest.fn(() => ({
        symbol: null,
        count: 0,
        level: 0,
        invited: false,
    })),
}));

const roomId = "!room:example.org";
const userId = "@alice:example.org";

class TestRoom extends EventEmitter {
    public roomId = roomId;
    public getMember = jest.fn();
}

class TestThread extends EventEmitter {
    public id = "$root";
    public length = 2;
    public replyToEvent?: MatrixEvent;

    public constructor(public room: Room) {
        super();
    }
}

function makeClient(): MatrixClient {
    return {
        decryptEventIfNeeded: jest.fn().mockResolvedValue(undefined),
    } as unknown as MatrixClient;
}

function makeEvent(body = "Latest reply"): MatrixEvent {
    const mxEvent = mkEvent({
        event: true,
        id: `$${body}`,
        type: EventType.RoomMessage,
        room: roomId,
        user: userId,
        content: {
            msgtype: MsgType.Text,
            body,
        },
    });
    mxEvent.sender = {
        userId,
        membership: "join",
        name: "Alice",
        rawDisplayName: "Alice",
        roomId,
        getAvatarUrl: jest.fn(),
        getMxcAvatarUrl: jest.fn(),
    } as unknown as RoomMember;
    return mxEvent;
}

function makeSummaryVm(overrides: Partial<ThreadSummaryViewModelProps> = {}): {
    vm: ThreadSummaryViewModel;
    thread: TestThread & Thread;
    rootEvent: MatrixEvent;
    room: TestRoom & Room;
} {
    const room = new TestRoom() as TestRoom & Room;
    const thread = new TestThread(room) as TestThread & Thread;
    thread.replyToEvent = makeEvent();
    const rootEvent = makeEvent("Root");
    const vm = new ThreadSummaryViewModel({
        cli: makeClient(),
        mxEvent: rootEvent,
        thread,
        room,
        timelineRenderingType: TimelineRenderingType.Room,
        lowBandwidth: false,
        useOnlyCurrentProfiles: false,
        narrow: true,
        isCard: false,
        ...overrides,
    });

    return { vm, thread, rootEvent, room };
}

describe("ThreadSummaryViewModel", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(determineUnreadState).mockReturnValue({
            symbol: null,
            count: 0,
            level: NotificationLevel.None,
            invited: false,
        });
        jest.spyOn(MessagePreviewStore.instance, "generatePreviewForEvent").mockReturnValue("Latest reply");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("computes initial summary state from the thread", () => {
        const { vm } = makeSummaryVm();

        expect(vm.getSnapshot().isVisible).toBe(true);
        expect(vm.getSnapshot().replyCountLabel).toBe("2");
        expect(vm.getSnapshot().narrow).toBe(true);
        expect(vm.getSnapshot().openThreadLabel).toBeTruthy();
    });

    it("updates visibility and reply count when the thread mutates", () => {
        const { vm, thread } = makeSummaryVm();

        thread.length = 0;
        thread.emit(ThreadEvent.Update);

        expect(vm.getSnapshot().isVisible).toBe(false);
        expect(vm.getSnapshot().replyCountLabel).toBe("0");
    });

    it("does not emit when setters receive unchanged values", () => {
        const { vm, thread, rootEvent } = makeSummaryVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setRootEvent(rootEvent);
        vm.setThread(thread);
        vm.setNarrow(true);
        vm.setIsCard(false);

        expect(listener).not.toHaveBeenCalled();
    });

    it("refreshes notification indicator for thread unread events", () => {
        const { vm, room, thread } = makeSummaryVm();
        jest.mocked(determineUnreadState).mockReturnValue({
            symbol: null,
            count: 1,
            level: NotificationLevel.Highlight,
            invited: false,
        });

        room.emit(RoomEvent.UnreadNotifications, {}, thread.id);

        expect(vm.getSnapshot().notificationIndicator).toBe("critical");
    });

    it("dispatches ShowThread and tracks interaction on click", () => {
        const { vm, rootEvent } = makeSummaryVm({ isCard: true });
        const event = { type: "click" } as MouseEvent<HTMLButtonElement>;

        vm.onClick(event);

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
            action: "show_thread",
            rootEvent,
            push: true,
        });
        expect(PosthogTrackers.trackInteraction).toHaveBeenCalledWith("WebRoomTimelineThreadSummaryButton", event);
    });
});

describe("ThreadMessagePreviewViewModel", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(determineUnreadState).mockReturnValue({
            symbol: null,
            count: 0,
            level: NotificationLevel.None,
            invited: false,
        });
        jest.spyOn(MessagePreviewStore.instance, "generatePreviewForEvent").mockImplementation((event) => {
            return event.getContent().body;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders the latest reply preview", async () => {
        const room = new TestRoom() as TestRoom & Room;
        const thread = new TestThread(room) as TestThread & Thread;
        thread.replyToEvent = makeEvent("First reply");
        const vm = new ThreadMessagePreviewViewModel({
            cli: makeClient(),
            thread,
            room,
            timelineRenderingType: TimelineRenderingType.Room,
            lowBandwidth: false,
            useOnlyCurrentProfiles: false,
            showDisplayName: true,
        });

        await waitFor(() => expect(vm.getSnapshot().isVisible).toBe(true));

        expect(vm.getSnapshot().senderName).toBe("Alice");
        expect(vm.getSnapshot().showDisplayName).toBe(true);
        expect(vm.getSnapshot().previewContent).toBe("First reply");
    });

    it("updates when the thread latest reply changes in place", async () => {
        const room = new TestRoom() as TestRoom & Room;
        const thread = new TestThread(room) as TestThread & Thread;
        thread.replyToEvent = makeEvent("First reply");
        const vm = new ThreadMessagePreviewViewModel({
            cli: makeClient(),
            thread,
            room,
            timelineRenderingType: TimelineRenderingType.Room,
            lowBandwidth: false,
            useOnlyCurrentProfiles: false,
            showDisplayName: false,
        });
        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("First reply"));

        thread.replyToEvent = makeEvent("Second reply");
        thread.emit(ThreadEvent.Update);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Second reply"));
    });
});
