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
    M_POLL_START,
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    MsgType,
    type Room,
    RoomEvent,
    type RoomMember,
    RoomStateEvent,
    type Thread,
    ThreadEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
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
    type ThreadMessagePreviewViewModelProps,
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
const clientMxcUrlToHttpMocks = new WeakMap<MatrixClient, jest.Mock>();

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

function makeClient(decryptEventIfNeeded = jest.fn().mockResolvedValue(undefined)): MatrixClient {
    const mxcUrlToHttp = jest.fn(
        (mxc: string, width?: number, height?: number, resizeMethod?: string) =>
            `https://matrix.example.org/_matrix/media/${mxc}/${width}x${height}/${resizeMethod}`,
    );
    const cli = {
        decryptEventIfNeeded,
        mxcUrlToHttp,
    } as unknown as MatrixClient;
    clientMxcUrlToHttpMocks.set(cli, mxcUrlToHttp);
    return cli;
}

function getMxcUrlToHttpMock(cli: MatrixClient): jest.Mock {
    const mock = clientMxcUrlToHttpMocks.get(cli);
    if (!mock) throw new Error("Missing mxcUrlToHttp mock for test client");
    return mock;
}

function makeMember(name: string, senderUserId = userId, mxcAvatarUrl?: string): RoomMember {
    return {
        userId: senderUserId,
        membership: "join",
        name,
        rawDisplayName: name,
        roomId,
        getAvatarUrl: jest.fn(),
        getMxcAvatarUrl: jest.fn(() => mxcAvatarUrl),
    } as unknown as RoomMember;
}

function makeEvent(
    body = "Latest reply",
    {
        type = EventType.RoomMessage,
        msgtype = MsgType.Text,
        senderName = "Alice",
        senderUserId = userId,
        mxcAvatarUrl,
    }: Partial<{
        type: string;
        msgtype: MsgType;
        senderName: string;
        senderUserId: string;
        mxcAvatarUrl: string;
    }> = {},
): MatrixEvent {
    const mxEvent = mkEvent({
        event: true,
        id: `$${body}`,
        type,
        room: roomId,
        user: senderUserId,
        content: {
            msgtype,
            body,
        },
    });
    mxEvent.sender = makeMember(senderName, senderUserId, mxcAvatarUrl);
    return mxEvent;
}

function makePreviewVm(overrides: Partial<ThreadMessagePreviewViewModelProps> = {}): {
    vm: ThreadMessagePreviewViewModel;
    thread: TestThread & Thread;
    room: TestRoom & Room;
    cli: MatrixClient;
} {
    const room = (overrides.room as (TestRoom & Room) | undefined) ?? (new TestRoom() as TestRoom & Room);
    const thread =
        (overrides.thread as (TestThread & Thread) | undefined) ?? (new TestThread(room) as TestThread & Thread);
    if (!thread.replyToEvent) {
        thread.replyToEvent = makeEvent();
    }

    const cli = overrides.cli ?? makeClient();
    const vm = new ThreadMessagePreviewViewModel({
        cli,
        thread,
        room,
        timelineRenderingType: TimelineRenderingType.Room,
        lowBandwidth: false,
        useOnlyCurrentProfiles: false,
        showDisplayName: false,
        ...overrides,
    });

    return { vm, thread, room, cli };
}

function makeSummaryVm(overrides: Partial<ThreadSummaryViewModelProps> = {}): {
    vm: ThreadSummaryViewModel;
    thread: TestThread & Thread;
    rootEvent: MatrixEvent;
    room: TestRoom & Room;
    cli: MatrixClient;
} {
    const room = new TestRoom() as TestRoom & Room;
    const thread = new TestThread(room) as TestThread & Thread;
    thread.replyToEvent = makeEvent();
    const rootEvent = makeEvent("Root");
    const cli = overrides.cli ?? makeClient();
    const vm = new ThreadSummaryViewModel({
        cli,
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

    return { vm, thread, rootEvent, room, cli };
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
        thread.emit(ThreadEvent.Update, thread);

        expect(vm.getSnapshot().isVisible).toBe(false);
        expect(vm.getSnapshot().replyCountLabel).toBe("0");
    });

    it("uses plural reply labels outside narrow mode and synchronizes the nested preview display name", () => {
        const { vm } = makeSummaryVm({ narrow: false });

        expect(vm.getSnapshot().replyCountLabel).toBe("2 replies");
        expect(vm.getSnapshot().previewVm.getSnapshot().showDisplayName).toBe(true);

        vm.setNarrow(true);

        expect(vm.getSnapshot().replyCountLabel).toBe("2");
        expect(vm.getSnapshot().narrow).toBe(true);
        expect(vm.getSnapshot().previewVm.getSnapshot().showDisplayName).toBe(false);
    });

    it("does not emit when setters receive unchanged values", () => {
        const { vm, thread, rootEvent, room, cli } = makeSummaryVm();
        const previewVm = vm.getSnapshot().previewVm as ThreadMessagePreviewViewModel;
        const setClientSpy = jest.spyOn(previewVm, "setClient");
        const setRoomSpy = jest.spyOn(previewVm, "setRoom");
        const setTimelineRenderingTypeSpy = jest.spyOn(previewVm, "setTimelineRenderingType");
        const setLowBandwidthSpy = jest.spyOn(previewVm, "setLowBandwidth");
        const setUseOnlyCurrentProfilesSpy = jest.spyOn(previewVm, "setUseOnlyCurrentProfiles");
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setRootEvent(rootEvent);
        vm.setClient(cli);
        vm.setThread(thread);
        vm.setRoom(room);
        vm.setTimelineRenderingType(TimelineRenderingType.Room);
        vm.setLowBandwidth(false);
        vm.setUseOnlyCurrentProfiles(false);
        vm.setNarrow(true);
        vm.setIsCard(false);

        expect(listener).not.toHaveBeenCalled();
        expect(setClientSpy).not.toHaveBeenCalled();
        expect(setRoomSpy).not.toHaveBeenCalled();
        expect(setTimelineRenderingTypeSpy).not.toHaveBeenCalled();
        expect(setLowBandwidthSpy).not.toHaveBeenCalled();
        expect(setUseOnlyCurrentProfilesSpy).not.toHaveBeenCalled();
    });

    it("forwards changed context inputs to the preview view model", () => {
        const { vm } = makeSummaryVm();
        const previewVm = vm.getSnapshot().previewVm as ThreadMessagePreviewViewModel;
        const nextClient = makeClient();
        const nextRoom = new TestRoom() as TestRoom & Room;

        const setClientSpy = jest.spyOn(previewVm, "setClient");
        const setRoomSpy = jest.spyOn(previewVm, "setRoom");
        const setTimelineRenderingTypeSpy = jest.spyOn(previewVm, "setTimelineRenderingType");
        const setLowBandwidthSpy = jest.spyOn(previewVm, "setLowBandwidth");
        const setUseOnlyCurrentProfilesSpy = jest.spyOn(previewVm, "setUseOnlyCurrentProfiles");

        vm.setClient(nextClient);
        vm.setRoom(nextRoom);
        vm.setTimelineRenderingType(TimelineRenderingType.Thread);
        vm.setLowBandwidth(true);
        vm.setUseOnlyCurrentProfiles(true);

        expect(setClientSpy).toHaveBeenCalledWith(nextClient);
        expect(setRoomSpy).toHaveBeenCalledWith(nextRoom);
        expect(setTimelineRenderingTypeSpy).toHaveBeenCalledWith(TimelineRenderingType.Thread);
        expect(setLowBandwidthSpy).toHaveBeenCalledWith(true);
        expect(setUseOnlyCurrentProfilesSpy).toHaveBeenCalledWith(true);
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

    it("ignores unread notifications for other threads and refreshes on room notification events", () => {
        const { vm, room } = makeSummaryVm();
        jest.mocked(determineUnreadState).mockClear();
        jest.mocked(determineUnreadState).mockReturnValue({
            symbol: null,
            count: 1,
            level: NotificationLevel.Notification,
            invited: false,
        });

        room.emit(RoomEvent.UnreadNotifications, {}, "$other-thread");

        expect(determineUnreadState).not.toHaveBeenCalled();
        expect(vm.getSnapshot().notificationIndicator).toBeUndefined();

        room.emit(RoomEvent.Receipt);

        expect(determineUnreadState).toHaveBeenCalledWith(room, "$root", false);
        expect(vm.getSnapshot().notificationIndicator).toBe("success");
    });

    it("rebinds thread listeners when the thread changes and removes them on dispose", () => {
        const { vm, thread, room } = makeSummaryVm();
        const nextRoom = new TestRoom() as TestRoom & Room;
        const nextThread = new TestThread(nextRoom) as TestThread & Thread;
        nextThread.length = 4;
        nextThread.replyToEvent = makeEvent("Next thread reply");

        vm.setThread(nextThread);

        expect(thread.listenerCount(ThreadEvent.Update)).toBe(0);
        expect(room.listenerCount(RoomEvent.Receipt)).toBe(0);
        expect(vm.getSnapshot().replyCountLabel).toBe("4");

        thread.length = 0;
        thread.emit(ThreadEvent.Update, thread);
        expect(vm.getSnapshot().replyCountLabel).toBe("4");

        nextThread.length = 5;
        nextThread.emit(ThreadEvent.Update, nextThread);
        expect(vm.getSnapshot().replyCountLabel).toBe("5");

        vm.dispose();

        expect(nextThread.listenerCount(ThreadEvent.Update)).toBe(0);
        expect(nextRoom.listenerCount(RoomEvent.Receipt)).toBe(0);
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

    it("uses the latest root event and card mode from setters when opening the thread", () => {
        const { vm } = makeSummaryVm();
        const nextRootEvent = makeEvent("Next root");
        const event = { type: "click" } as MouseEvent<HTMLButtonElement>;

        vm.setRootEvent(nextRootEvent);
        vm.setIsCard(true);
        vm.onClick(event);

        expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
            action: "show_thread",
            rootEvent: nextRootEvent,
            push: true,
        });
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

    it("hides the preview when the thread has no latest reply", () => {
        const room = new TestRoom() as TestRoom & Room;
        const thread = new TestThread(room) as TestThread & Thread;
        const vm = new ThreadMessagePreviewViewModel({
            cli: makeClient(),
            thread,
            room,
            timelineRenderingType: TimelineRenderingType.Room,
            lowBandwidth: false,
            useOnlyCurrentProfiles: false,
            showDisplayName: true,
        });

        expect(vm.getSnapshot().isVisible).toBe(false);
        expect(vm.getSnapshot().avatar).toBeUndefined();
        expect(vm.getSnapshot().senderName).toBeUndefined();
        expect(vm.getSnapshot().previewContent).toBeUndefined();
        expect(vm.getSnapshot().previewTooltip).toBeUndefined();
        expect(vm.getSnapshot().showDisplayName).toBe(true);
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

    it("skips preview recomputation when guarded setters receive unchanged values", async () => {
        const { vm, thread, room, cli } = makePreviewVm();
        await waitFor(() => expect(vm.getSnapshot().isVisible).toBe(true));
        jest.mocked(cli.decryptEventIfNeeded).mockClear();

        vm.setClient(cli);
        vm.setThread(thread);
        vm.setRoom(room);
        vm.setTimelineRenderingType(TimelineRenderingType.Room);
        vm.setLowBandwidth(false);
        vm.setUseOnlyCurrentProfiles(false);

        expect(cli.decryptEventIfNeeded).not.toHaveBeenCalled();
        expect(thread.listenerCount(ThreadEvent.Update)).toBe(1);
    });

    it.each([
        ["audio", EventType.RoomMessage, MsgType.Audio],
        ["image", EventType.RoomMessage, MsgType.Image],
        ["video", EventType.RoomMessage, MsgType.Video],
        ["file", EventType.RoomMessage, MsgType.File],
        ["poll", M_POLL_START.name, undefined],
    ])("renders a prefixed preview for %s replies", async (_name, type, msgtype) => {
        const { vm } = makePreviewVm({
            thread: new TestThread(new TestRoom() as TestRoom & Room) as TestThread & Thread,
        });
        vm.setThread(
            Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: makeEvent("Attachment preview", msgtype === undefined ? { type } : { type, msgtype }),
            }) as TestThread & Thread,
        );

        await waitFor(() => expect(vm.getSnapshot().isVisible).toBe(true));

        expect(vm.getSnapshot().previewContent).not.toBe("Attachment preview");
        expect(vm.getSnapshot().previewTooltip).toBeUndefined();
    });

    it("reuses prefixed preview content when the generated text has not changed", async () => {
        const event = makeEvent("Image preview", { msgtype: MsgType.Image });
        const { vm } = makePreviewVm({
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: event,
            }) as TestThread & Thread,
        });
        await waitFor(() => expect(vm.getSnapshot().isVisible).toBe(true));
        const previewContent = vm.getSnapshot().previewContent;

        event.emit(MatrixEventEvent.Decrypted, event);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe(previewContent));
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
        thread.emit(ThreadEvent.Update, thread);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Second reply"));
    });

    it("updates when the watched event is replaced or decrypted", async () => {
        const event = makeEvent("First reply");
        const { vm } = makePreviewVm({
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: event,
            }) as TestThread & Thread,
        });
        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("First reply"));

        jest.mocked(MessagePreviewStore.instance.generatePreviewForEvent).mockReturnValue("Edited reply");
        event.emit(MatrixEventEvent.Replaced, event);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Edited reply"));

        jest.mocked(MessagePreviewStore.instance.generatePreviewForEvent).mockReturnValue("Decrypted reply");
        event.emit(MatrixEventEvent.Decrypted, event);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Decrypted reply"));
    });

    it("hides redacted replies and replies without generated previews", async () => {
        const redactedEvent = makeEvent("Redacted reply");
        jest.spyOn(redactedEvent, "isRedacted").mockReturnValue(true);
        const redactedVm = makePreviewVm({
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: redactedEvent,
            }) as TestThread & Thread,
        }).vm;

        expect(redactedVm.getSnapshot().isVisible).toBe(false);

        jest.mocked(MessagePreviewStore.instance.generatePreviewForEvent).mockReturnValue("");
        const emptyPreviewVm = makePreviewVm({
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: makeEvent("Unsupported reply"),
            }) as TestThread & Thread,
        }).vm;

        await waitFor(() => expect(MessagePreviewStore.instance.generatePreviewForEvent).toHaveBeenCalled());
        expect(emptyPreviewVm.getSnapshot().isVisible).toBe(false);
    });

    it("shows a decryption failure preview without trying to decrypt again", async () => {
        const decryptionFailureEvent = makeEvent("Encrypted reply");
        jest.spyOn(decryptionFailureEvent, "isDecryptionFailure").mockReturnValue(true);
        const cli = makeClient();
        const { vm } = makePreviewVm({
            cli,
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: decryptionFailureEvent,
            }) as TestThread & Thread,
        });

        await waitFor(() => expect(vm.getSnapshot().isVisible).toBe(true));

        expect(cli.decryptEventIfNeeded).not.toHaveBeenCalled();
        expect(vm.getSnapshot().previewContent).toBe("Unable to decrypt message");
        expect(vm.getSnapshot().previewTooltip).toBe("Unable to decrypt message");
    });

    it("logs and hides the preview when decryption rejects", async () => {
        const decryptError = new Error("No key");
        const cli = makeClient(jest.fn().mockRejectedValue(decryptError));
        const loggerSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
        const { vm } = makePreviewVm({ cli });

        await waitFor(() =>
            expect(loggerSpy).toHaveBeenCalledWith("Failed to decrypt thread preview event", decryptError),
        );

        expect(vm.getSnapshot().isVisible).toBe(false);
    });

    it("catches fire-and-forget preview update errors", async () => {
        const previewError = new Error("Preview failed");
        jest.mocked(MessagePreviewStore.instance.generatePreviewForEvent).mockImplementation(() => {
            throw previewError;
        });
        const loggerSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

        makePreviewVm();

        await waitFor(() => expect(loggerSpy).toHaveBeenCalledWith("Failed to update thread preview", previewError));
    });

    it("shows a decryption failure preview when decryption rejects into a failure state", async () => {
        const decryptError = new Error("No key");
        const event = makeEvent("Encrypted reply");
        const isDecryptionFailureSpy = jest.spyOn(event, "isDecryptionFailure").mockReturnValue(false);
        const cli = makeClient(
            jest.fn().mockImplementation(async () => {
                isDecryptionFailureSpy.mockReturnValue(true);
                throw decryptError;
            }),
        );
        jest.spyOn(logger, "error").mockImplementation(() => {});
        const { vm } = makePreviewVm({
            cli,
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: event,
            }) as TestThread & Thread,
        });

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Unable to decrypt message"));

        expect(vm.getSnapshot().isVisible).toBe(true);
        expect(vm.getSnapshot().previewTooltip).toBe("Unable to decrypt message");
    });

    it("hides the preview when an event is redacted during decryption", async () => {
        const event = makeEvent("Redacted during decrypt");
        const isRedactedSpy = jest.spyOn(event, "isRedacted").mockReturnValue(false);
        const cli = makeClient(
            jest.fn().mockImplementation(async () => {
                isRedactedSpy.mockReturnValue(true);
            }),
        );
        const { vm } = makePreviewVm({
            cli,
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: event,
            }) as TestThread & Thread,
        });

        await waitFor(() => expect(isRedactedSpy).toHaveBeenCalledTimes(2));

        expect(vm.getSnapshot().isVisible).toBe(false);
        expect(MessagePreviewStore.instance.generatePreviewForEvent).not.toHaveBeenCalled();
    });

    it("shows a decryption failure preview when an event fails after decryption", async () => {
        const event = makeEvent("Failure during decrypt");
        const isDecryptionFailureSpy = jest.spyOn(event, "isDecryptionFailure").mockReturnValue(false);
        const cli = makeClient(
            jest.fn().mockImplementation(async () => {
                isDecryptionFailureSpy.mockReturnValue(true);
            }),
        );
        const { vm } = makePreviewVm({
            cli,
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: event,
            }) as TestThread & Thread,
        });

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Unable to decrypt message"));

        expect(vm.getSnapshot().isVisible).toBe(true);
        expect(MessagePreviewStore.instance.generatePreviewForEvent).not.toHaveBeenCalled();
    });

    it("ignores stale decrypt results when the latest reply changes during decryption", async () => {
        let resolveFirstDecrypt!: () => void;
        const firstDecrypt = new Promise<void>((resolve) => {
            resolveFirstDecrypt = resolve;
        });
        const cli = makeClient(jest.fn().mockReturnValueOnce(firstDecrypt).mockResolvedValue(undefined));
        const room = new TestRoom() as TestRoom & Room;
        const thread = new TestThread(room) as TestThread & Thread;
        thread.replyToEvent = makeEvent("First reply");
        const vm = new ThreadMessagePreviewViewModel({
            cli,
            thread,
            room,
            timelineRenderingType: TimelineRenderingType.Room,
            lowBandwidth: false,
            useOnlyCurrentProfiles: false,
            showDisplayName: false,
        });

        thread.replyToEvent = makeEvent("Second reply");
        thread.emit(ThreadEvent.Update, thread);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Second reply"));

        resolveFirstDecrypt();

        await Promise.resolve();

        expect(vm.getSnapshot().previewContent).toBe("Second reply");
    });

    it("ignores stale decrypt errors when the latest reply changes before rejection", async () => {
        let rejectFirstDecrypt!: (error: Error) => void;
        const firstDecrypt = new Promise<void>((_resolve, reject) => {
            rejectFirstDecrypt = reject;
        });
        const cli = makeClient(jest.fn().mockReturnValueOnce(firstDecrypt).mockResolvedValue(undefined));
        const loggerSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
        const room = new TestRoom() as TestRoom & Room;
        const thread = new TestThread(room) as TestThread & Thread;
        thread.replyToEvent = makeEvent("First reply");
        const vm = new ThreadMessagePreviewViewModel({
            cli,
            thread,
            room,
            timelineRenderingType: TimelineRenderingType.Room,
            lowBandwidth: false,
            useOnlyCurrentProfiles: false,
            showDisplayName: false,
        });

        thread.replyToEvent = makeEvent("Second reply");
        thread.emit(ThreadEvent.Update, thread);

        await waitFor(() => expect(vm.getSnapshot().previewContent).toBe("Second reply"));

        rejectFirstDecrypt(new Error("Stale decrypt"));
        await waitFor(() => expect(loggerSpy).toHaveBeenCalled());

        expect(vm.getSnapshot().previewContent).toBe("Second reply");
    });

    it("uses current room profiles and avatar thumbnails when requested", async () => {
        const room = new TestRoom() as TestRoom & Room;
        const currentMember = makeMember("Current Alice", userId, "mxc://example.org/avatar");
        room.getMember.mockReturnValue(currentMember);
        const { vm, cli } = makePreviewVm({
            room,
            useOnlyCurrentProfiles: true,
            thread: Object.assign(new TestThread(room), {
                replyToEvent: makeEvent("Profile reply", { senderName: "Historical Alice" }),
            }) as TestThread & Thread,
        });

        await waitFor(() => expect(vm.getSnapshot().senderName).toBe("Current Alice"));

        expect(vm.getSnapshot().avatar).toEqual(
            expect.objectContaining({
                id: userId,
                name: "Current Alice",
                src: "https://matrix.example.org/_matrix/media/mxc://example.org/avatar/24x24/crop",
            }),
        );
        expect(getMxcUrlToHttpMock(cli)).toHaveBeenCalledWith("mxc://example.org/avatar", 24, 24, "crop", false, true);
    });

    it("updates the avatar and sender when the current room member profile changes", async () => {
        const room = new TestRoom() as TestRoom & Room;
        const historicalEvent = makeEvent("Profile update reply", { senderName: "Historical Alice" });
        const { vm } = makePreviewVm({
            room,
            timelineRenderingType: TimelineRenderingType.ThreadsList,
            thread: Object.assign(new TestThread(room), {
                replyToEvent: historicalEvent,
            }) as TestThread & Thread,
        });
        await waitFor(() => expect(vm.getSnapshot().senderName).toBe("Historical Alice"));

        const currentMember = makeMember("Current Alice", userId, "mxc://example.org/current-avatar");
        room.getMember.mockReturnValue(currentMember);
        room.emit(RoomStateEvent.Members, makeEvent("Member event"), room, currentMember);

        await waitFor(() => expect(vm.getSnapshot().senderName).toBe("Current Alice"));
        expect(vm.getSnapshot().avatar).toEqual(
            expect.objectContaining({
                id: userId,
                name: "Current Alice",
                src: "https://matrix.example.org/_matrix/media/mxc://example.org/current-avatar/24x24/crop",
            }),
        );
    });

    it("ignores current room member profile updates for other users and unsubscribes on dispose", async () => {
        const room = new TestRoom() as TestRoom & Room;
        const { vm } = makePreviewVm({
            room,
            timelineRenderingType: TimelineRenderingType.ThreadsList,
            thread: Object.assign(new TestThread(room), {
                replyToEvent: makeEvent("Profile listener reply", { senderName: "Historical Alice" }),
            }) as TestThread & Thread,
        });
        await waitFor(() => expect(vm.getSnapshot().senderName).toBe("Historical Alice"));

        expect(room.listenerCount(RoomStateEvent.Members)).toBe(1);

        room.getMember.mockReturnValue(makeMember("Current Alice", userId, "mxc://example.org/avatar"));
        room.emit(
            RoomStateEvent.Members,
            makeEvent("Other member event"),
            room,
            makeMember("Other User", "@other:example.org"),
        );

        expect(vm.getSnapshot().senderName).toBe("Historical Alice");

        vm.dispose();

        expect(room.listenerCount(RoomStateEvent.Members)).toBe(0);
    });

    it("uses current room profiles in thread timelines and suppresses avatar URLs in low-bandwidth mode", async () => {
        const room = new TestRoom() as TestRoom & Room;
        room.getMember.mockReturnValue(makeMember("Thread Alice", userId, "mxc://example.org/avatar"));
        const { vm, cli } = makePreviewVm({
            room,
            timelineRenderingType: TimelineRenderingType.Thread,
            lowBandwidth: true,
            useOnlyCurrentProfiles: false,
            thread: Object.assign(new TestThread(room), {
                replyToEvent: makeEvent("Low bandwidth reply", { senderName: "Historical Alice" }),
            }) as TestThread & Thread,
        });

        await waitFor(() => expect(vm.getSnapshot().senderName).toBe("Thread Alice"));

        expect(vm.getSnapshot().avatar).toEqual(
            expect.objectContaining({
                name: "Thread Alice",
                src: undefined,
            }),
        );
        expect(getMxcUrlToHttpMock(cli)).not.toHaveBeenCalled();
    });

    it("falls back to historical sender profiles when no current member exists", async () => {
        const room = new TestRoom() as TestRoom & Room;
        room.getMember.mockReturnValue(null);
        const { vm } = makePreviewVm({
            room,
            useOnlyCurrentProfiles: true,
            thread: Object.assign(new TestThread(room), {
                replyToEvent: makeEvent("Historical profile reply", { senderName: "Historical Alice" }),
            }) as TestThread & Thread,
        });

        await waitFor(() => expect(vm.getSnapshot().senderName).toBe("Historical Alice"));

        expect(vm.getSnapshot().avatar).toEqual(
            expect.objectContaining({
                id: userId,
                name: "Historical Alice",
            }),
        );
    });

    it("falls back to the sender id when event sender profile data is missing", async () => {
        const mxEvent = makeEvent("Missing sender profile");
        mxEvent.sender = null;
        jest.spyOn(mxEvent, "getSender").mockReturnValue("@fallback:example.org");
        const { vm } = makePreviewVm({
            thread: Object.assign(new TestThread(new TestRoom() as TestRoom & Room), {
                replyToEvent: mxEvent,
            }) as TestThread & Thread,
        });

        await waitFor(() => expect(vm.getSnapshot().senderName).toBe("@fallback:example.org"));

        expect(vm.getSnapshot().avatar).toEqual(
            expect.objectContaining({
                id: "@fallback:example.org",
                name: "@fallback:example.org",
                title: undefined,
            }),
        );
    });
});
