/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import EventEmitter from "node:events";
import { waitFor } from "@testing-library/dom";
import {
    EventStatus,
    EventTimeline,
    EventType,
    M_BEACON_INFO,
    MatrixEvent,
    MatrixEventEvent,
    MsgType,
    RelationType,
    RoomStateEvent,
} from "matrix-js-sdk/src/matrix";
import { ActionBarAction } from "@element-hq/web-shared-components";
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from "vitest";
import { createTestClient } from "test-utils";

import { EventTileActionBarViewModel, type EventTileActionBarViewModelProps } from "./EventTileActionBarViewModel";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import Resend from "../../Resend";
import PinningUtils from "../../utils/PinningUtils";
import PosthogTrackers from "../../PosthogTrackers";
import Modal from "../../Modal";
import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import SettingsStore from "../../settings/SettingsStore";
import { ModuleApi } from "../../modules/Api";
import { canCancel, canEditContent, editEvent, isContentActionable } from "../../utils/EventUtils";
import { shouldDisplayReply } from "../../utils/Reply";
import { MediaEventHelper } from "../../utils/MediaEventHelper";
import { getMediaVisibility, setMediaVisibility } from "../../utils/media/mediaVisibility";

vi.mock("../../dispatcher/dispatcher", () => ({
    __esModule: true,
    default: {
        dispatch: vi.fn(),
        register: vi.fn().mockReturnValue("dispatcher-ref"),
        unregister: vi.fn(),
    },
}));

vi.mock("../../Resend", () => ({
    __esModule: true,
    default: {
        resend: vi.fn(),
        removeFromQueue: vi.fn(),
    },
}));

vi.mock("../../PosthogTrackers", () => ({
    __esModule: true,
    default: {
        trackPinUnpinMessage: vi.fn(),
    },
}));

vi.mock("../../Modal", () => ({
    __esModule: true,
    default: {
        createDialog: vi.fn(),
    },
}));

vi.mock("../../languageHandler", () => ({
    _t: (key: string) => {
        switch (key) {
            case "timeline|download_failed":
                return "Download failed";
            case "timeline|download_failed_description":
                return "Failed to download file";
            case "common|image":
                return "Image";
            default:
                return key;
        }
    },
    _td: (key: string) => key,
}));

vi.mock("../../utils/EventUtils", () => ({
    canCancel: vi.fn(),
    canEditContent: vi.fn(),
    editEvent: vi.fn(),
    isContentActionable: vi.fn(),
}));

vi.mock("../../utils/PinningUtils", () => ({
    __esModule: true,
    default: {
        canPin: vi.fn(),
        canUnpin: vi.fn(),
        isPinned: vi.fn(),
        pinOrUnpinEvent: vi.fn(),
    },
}));

vi.mock("../../utils/Reply", () => ({
    shouldDisplayReply: vi.fn(),
}));

vi.mock("../../utils/media/mediaVisibility", () => ({
    getMediaVisibility: vi.fn(),
    setMediaVisibility: vi.fn(),
}));

const mockDownload = vi.fn();
vi.mock("../../utils/FileDownloader", () => ({
    FileDownloader: vi.fn().mockImplementation(function () {
        return {
            download: mockDownload,
        };
    }),
}));

describe("EventTileActionBarViewModel", () => {
    const userId = "@alice:example.org";
    const roomId = "!room:example.org";
    const rootEvent = new MatrixEvent({
        type: EventType.RoomMessage,
        room_id: roomId,
        sender: "@root:example.org",
        event_id: "$root",
        content: { msgtype: MsgType.Text, body: "Root" },
    });

    let client: ReturnType<typeof createTestClient>;
    let roomState: EventEmitter;
    let room: {
        getLiveTimeline: Mock;
    };
    let getHintsForMessageSpy: Mock;

    const createMessageEvent = (overrides: Partial<ConstructorParameters<typeof MatrixEvent>[0]> = {}): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: roomId,
            sender: userId,
            event_id: "$event",
            content: { msgtype: MsgType.Text, body: "Hello" },
            ...overrides,
        });

    const createVm = (props: Partial<EventTileActionBarViewModelProps> = {}): EventTileActionBarViewModel => {
        const mxEvent = props.mxEvent ?? createMessageEvent();
        return new EventTileActionBarViewModel({
            mxEvent,
            timelineRenderingType: TimelineRenderingType.Room,
            canSendMessages: true,
            canReact: true,
            ...props,
        });
    };

    const createPendingPromise = <T>(): {
        promise: Promise<T>;
        resolve: (value: T) => void;
        reject: (reason?: unknown) => void;
    } => {
        let resolve!: (value: T) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    beforeEach(() => {
        vi.clearAllMocks();
        client = createTestClient();
        roomState = new EventEmitter();
        room = {
            getLiveTimeline: vi.fn().mockReturnValue({
                getState: vi.fn().mockImplementation((dir) => (dir === EventTimeline.FORWARDS ? roomState : undefined)),
            }),
        };

        vi.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);
        vi.spyOn(client, "getRoom").mockReturnValue(room as never);
        vi.spyOn(client, "decryptEventIfNeeded");

        vi.spyOn(SettingsStore, "watchSetting").mockImplementation((name, scope) => `${name}:${scope ?? "global"}`);
        vi.spyOn(SettingsStore, "unwatchSetting").mockImplementation(() => {});

        vi.mocked(canCancel).mockImplementation((status) => status === EventStatus.QUEUED);
        vi.mocked(canEditContent).mockReturnValue(true);
        vi.mocked(isContentActionable).mockReturnValue(true);
        vi.mocked(shouldDisplayReply).mockReturnValue(true);
        vi.mocked(getMediaVisibility).mockReturnValue(true);
        vi.mocked(setMediaVisibility).mockResolvedValue(undefined);
        vi.mocked(PinningUtils.canPin).mockReturnValue(false);
        vi.mocked(PinningUtils.canUnpin).mockReturnValue(false);
        vi.mocked(PinningUtils.isPinned).mockReturnValue(false);
        vi.mocked(PinningUtils.pinOrUnpinEvent).mockResolvedValue(undefined);
        vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(false);
        vi.spyOn(MediaEventHelper, "canHide").mockReturnValue(false);
        mockDownload.mockResolvedValue(undefined);

        getHintsForMessageSpy = vi.spyOn(ModuleApi.instance.customComponents, "getHintsForMessage");
        getHintsForMessageSpy.mockReturnValue(null);
    });

    afterEach(() => {
        getHintsForMessageSpy.mockRestore();
        vi.restoreAllMocks();
    });

    it("builds the snapshot for an actionable message", async () => {
        const vm = createVm({ isQuoteExpanded: true });

        await waitFor(() =>
            expect(vm.getSnapshot()).toMatchObject({
                actions: [
                    ActionBarAction.React,
                    ActionBarAction.Reply,
                    ActionBarAction.ReplyInThread,
                    ActionBarAction.Edit,
                    ActionBarAction.Expand,
                    ActionBarAction.Options,
                ],
                presentation: "icon",
                isDownloadEncrypted: false,
                isDownloadLoading: false,
                isPinned: false,
                isQuoteExpanded: true,
                isThreadReplyAllowed: true,
            }),
        );
    });

    it("reacts to media download permission hints and room state updates", async () => {
        vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
        vi.spyOn(MediaEventHelper, "canHide").mockReturnValue(true);
        getHintsForMessageSpy.mockReturnValue({
            allowDownloadingMedia: vi.fn().mockResolvedValue(true),
        } as never);

        const vm = createVm({
            mxEvent: createMessageEvent({
                content: { msgtype: MsgType.Image, body: "Image", url: "mxc://example.org/file" },
            }),
        });

        expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download);
        expect(vm.getSnapshot().actions).toContain(ActionBarAction.Hide);

        await waitFor(() => expect(vm.getSnapshot().actions).toContain(ActionBarAction.Download));

        vi.mocked(PinningUtils.isPinned).mockReturnValue(true);
        roomState.emit(
            RoomStateEvent.Events,
            new MatrixEvent({
                type: EventType.RoomPinnedEvents,
                room_id: roomId,
                sender: userId,
                content: { pinned: ["$event"] },
            }),
        );

        expect(vm.getSnapshot().isPinned).toBe(true);

        vi.mocked(getMediaVisibility).mockReturnValue(false);
        roomState.emit(
            RoomStateEvent.Events,
            new MatrixEvent({
                type: EventType.RoomJoinRules,
                room_id: roomId,
                sender: userId,
                content: { join_rule: "public" },
            }),
        );

        expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Hide);
    });

    it("ignores stale download permission results after setProps changes the event", async () => {
        vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
        const permissionA = createPendingPromise<boolean>();
        const permissionB = createPendingPromise<boolean>();
        const eventA = createMessageEvent({
            event_id: "$eventA",
            content: { msgtype: MsgType.Image, body: "Image A", url: "mxc://example.org/a" },
        });
        const eventB = createMessageEvent({
            event_id: "$eventB",
            content: { msgtype: MsgType.Image, body: "Image B", url: "mxc://example.org/b" },
        });

        getHintsForMessageSpy.mockImplementation((event) => {
            if (event === eventA) {
                return {
                    allowDownloadingMedia: vi.fn().mockReturnValue(permissionA.promise),
                } as never;
            }

            if (event === eventB) {
                return {
                    allowDownloadingMedia: vi.fn().mockReturnValue(permissionB.promise),
                } as never;
            }

            return null;
        });

        const vm = createVm({ mxEvent: eventA });
        expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download);

        vm.setProps({ mxEvent: eventB });
        permissionA.resolve(true);
        await Promise.resolve();

        expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download);

        permissionB.resolve(false);
        await Promise.resolve();

        expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download);
    });

    it("refreshes on event status changes and removes listeners on dispose", () => {
        const mxEvent = createMessageEvent();
        const offSpy = vi.spyOn(mxEvent, "off");
        const roomStateOffSpy = vi.spyOn(roomState, "off");
        const vm = createVm({ mxEvent });

        expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Cancel);

        mxEvent.setStatus(EventStatus.QUEUED);

        expect(vm.getSnapshot().actions).toContain(ActionBarAction.Cancel);
        expect(client.decryptEventIfNeeded).toHaveBeenCalledWith(mxEvent);

        vm.dispose();

        expect(offSpy).toHaveBeenCalledWith(MatrixEventEvent.Status, expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith(MatrixEventEvent.Decrypted, expect.any(Function));
        expect(offSpy).toHaveBeenCalledWith(MatrixEventEvent.BeforeRedaction, expect.any(Function));
        expect(roomStateOffSpy).toHaveBeenCalledWith(RoomStateEvent.Events, expect.any(Function));
        expect(SettingsStore.unwatchSetting).toHaveBeenCalledWith("mediaPreviewConfig:!room:example.org");
        expect(SettingsStore.unwatchSetting).toHaveBeenCalledWith("showMediaEventIds:global");
    });

    it("routes resend and cancel actions to the actionable failed event variant", () => {
        const mxEvent = createMessageEvent();
        const localRedactionEvent = createMessageEvent({ event_id: "$redaction" });
        const replacingEvent = createMessageEvent({ event_id: "$replacement" });

        localRedactionEvent.setStatus(EventStatus.SENT);
        replacingEvent.setStatus(EventStatus.QUEUED);

        vi.spyOn(mxEvent, "localRedactionEvent").mockReturnValue(localRedactionEvent);
        vi.spyOn(mxEvent, "replacingEvent").mockReturnValue(replacingEvent);

        const vm = createVm({ mxEvent });

        vm.onResendClick(null);
        vm.onCancelClick(null);

        expect(Resend.resend).toHaveBeenCalledWith(client, localRedactionEvent);
        expect(Resend.removeFromQueue).toHaveBeenCalledWith(client, replacingEvent);
    });

    it("downloads a cached blob and shows an error dialog on failure", async () => {
        const blob = new Blob(["downloaded"]);
        vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);

        const vm = createVm({
            mxEvent: createMessageEvent({
                content: { msgtype: MsgType.Image, body: "Image", url: "mxc://example.org/file" },
            }),
        });
        (vm as unknown as { downloadedBlob: Blob }).downloadedBlob = blob;

        await vm.onDownloadClick(null);
        await vm.onDownloadClick(null);

        expect(mockDownload).toHaveBeenNthCalledWith(1, { blob, name: "Image" });
        expect(mockDownload).toHaveBeenNthCalledWith(2, { blob, name: "Image" });

        mockDownload.mockRejectedValueOnce(new Error("boom"));

        await vm.onDownloadClick(null);

        expect(Modal.createDialog).toHaveBeenCalledWith(
            ErrorDialog,
            expect.objectContaining({
                title: "Download failed",
                description: expect.stringContaining("boom"),
            }),
        );
        expect(vm.getSnapshot().isDownloadLoading).toBe(false);
    });

    it("ignores stale download completion after setProps changes the event", async () => {
        vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
        const firstDownload = createPendingPromise<void>();
        const eventA = createMessageEvent({
            event_id: "$eventA",
            content: { msgtype: MsgType.Image, body: "Image A", url: "mxc://example.org/a" },
        });
        const eventB = createMessageEvent({
            event_id: "$eventB",
            content: { msgtype: MsgType.Image, body: "Image B", url: "mxc://example.org/b" },
        });

        const vm = createVm({ mxEvent: eventA });
        (vm as unknown as { downloadedBlob: Blob }).downloadedBlob = new Blob(["a"]);
        mockDownload.mockReturnValueOnce(firstDownload.promise);

        const firstDownloadCall = vm.onDownloadClick(null);

        expect(vm.getSnapshot().isDownloadLoading).toBe(true);

        vm.setProps({ mxEvent: eventB });
        (vm as unknown as { downloadedBlob: Blob }).downloadedBlob = new Blob(["b"]);

        expect(vm.getSnapshot().isDownloadLoading).toBe(false);

        const secondDownload = vm.onDownloadClick(null);
        await secondDownload;

        firstDownload.resolve();
        await firstDownloadCall;

        expect(mockDownload).toHaveBeenCalledTimes(2);
        expect(mockDownload).toHaveBeenNthCalledWith(2, {
            blob: expect.any(Blob),
            name: "Image B",
        });
        expect(vm.getSnapshot().isDownloadLoading).toBe(false);
    });

    it("ignores stale download permission results after dispose", async () => {
        vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
        const permission = createPendingPromise<boolean>();
        const event = createMessageEvent({
            event_id: "$eventA",
            content: { msgtype: MsgType.Image, body: "Image A", url: "mxc://example.org/a" },
        });

        getHintsForMessageSpy.mockReturnValue({
            allowDownloadingMedia: vi.fn().mockReturnValue(permission.promise),
        } as never);

        const vm = createVm({ mxEvent: event });
        expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download);

        vm.dispose();
        permission.resolve(true);
        await Promise.resolve();

        expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download);
    });

    it("dispatches reply and thread actions and forwards callbacks", async () => {
        const onOptionsClick = vi.fn();
        const onReactionsClick = vi.fn();
        const onToggleThreadExpanded = vi.fn();
        const threadReply = createMessageEvent({
            sender: "@bob:example.org",
            event_id: "$reply",
            content: {
                "msgtype": MsgType.Text,
                "body": "Reply",
                "m.relates_to": {
                    rel_type: RelationType.Thread,
                    event_id: rootEvent.getId(),
                },
            },
        });

        Object.defineProperty(threadReply, "isThreadRoot", { value: false });
        vi.spyOn(threadReply, "getThread").mockReturnValue({ rootEvent } as never);

        const vm = createVm({
            mxEvent: threadReply,
            isCard: true,
            onOptionsClick,
            onReactionsClick,
            onToggleThreadExpanded,
        });
        vi.mocked(PinningUtils.isPinned).mockReturnValue(false);

        vm.onReplyClick(null);
        vm.onReplyInThreadClick(null);
        vm.onEditClick(null);
        await vm.onPinClick(null);
        vm.onHideClick(null);
        vm.onOptionsClick(null);
        vm.onReactionsClick(null);
        vm.onToggleThreadExpanded(null);

        expect(defaultDispatcher.dispatch).toHaveBeenNthCalledWith(1, {
            action: "reply_to_event",
            event: threadReply,
            context: TimelineRenderingType.Room,
        });
        expect(defaultDispatcher.dispatch).toHaveBeenNthCalledWith(2, {
            action: Action.ShowThread,
            rootEvent,
            initialEvent: threadReply,
            scroll_into_view: true,
            highlighted: true,
            push: true,
        });
        expect(editEvent).toHaveBeenCalledWith(client, threadReply, TimelineRenderingType.Room, undefined);
        expect(PinningUtils.pinOrUnpinEvent).toHaveBeenCalledWith(client, threadReply);
        expect(PosthogTrackers.trackPinUnpinMessage).toHaveBeenCalledWith(expect.any(String), "Timeline");
        expect(setMediaVisibility).toHaveBeenCalledWith(threadReply, false);
        expect(onOptionsClick).toHaveBeenCalledWith(null);
        expect(onReactionsClick).toHaveBeenCalledWith(null);
        expect(onToggleThreadExpanded).toHaveBeenCalledWith(null);
    });

    describe("business logic parity", () => {
        it.each([
            {
                name: "hides reply and react for non-actionable events",
                actionable: false,
                props: {},
                expectedActions: [],
                unexpectedActions: [ActionBarAction.Reply, ActionBarAction.React],
            },
            {
                name: "hides reply when sending messages is disabled",
                actionable: true,
                props: { canSendMessages: false },
                expectedActions: [ActionBarAction.React],
                unexpectedActions: [ActionBarAction.Reply],
            },
            {
                name: "hides react when reactions are disabled",
                actionable: true,
                props: { canReact: false },
                expectedActions: [ActionBarAction.Reply],
                unexpectedActions: [ActionBarAction.React],
            },
            {
                name: "hides react in search results",
                actionable: true,
                props: { isSearch: true },
                expectedActions: [ActionBarAction.Reply],
                unexpectedActions: [ActionBarAction.React],
            },
        ])("$name", ({ actionable, props, expectedActions, unexpectedActions }) => {
            vi.mocked(isContentActionable).mockReturnValue(actionable);

            const vm = createVm(props);

            expectedActions.forEach((action) => expect(vm.getSnapshot().actions).toContain(action));
            unexpectedActions.forEach((action) => expect(vm.getSnapshot().actions).not.toContain(action));
        });

        it.each([
            {
                name: "shows expand collapse only when quote state is provided and reply should display",
                quoteExpanded: true,
                displayReply: true,
                expected: true,
            },
            {
                name: "hides expand collapse when quote state is missing",
                quoteExpanded: undefined,
                displayReply: true,
                expected: false,
            },
            {
                name: "hides expand collapse when reply should not display",
                quoteExpanded: false,
                displayReply: false,
                expected: false,
            },
        ])("$name", ({ quoteExpanded, displayReply, expected }) => {
            vi.mocked(shouldDisplayReply).mockReturnValue(displayReply);

            const vm = createVm({ isQuoteExpanded: quoteExpanded });

            expect(vm.getSnapshot().actions.includes(ActionBarAction.Expand)).toBe(expected);
        });

        it.each([
            {
                name: "allows reply in thread for normal room messages in room timeline",
                timelineRenderingType: TimelineRenderingType.Room,
                content: { msgtype: MsgType.Text, body: "Hello" },
                relation: undefined,
                type: EventType.RoomMessage,
                expectedReplyInThread: true,
                expectedAllowed: true,
            },
            {
                name: "blocks reply in thread in thread timeline",
                timelineRenderingType: TimelineRenderingType.Thread,
                content: { msgtype: MsgType.Text, body: "Hello" },
                relation: undefined,
                type: EventType.RoomMessage,
                expectedReplyInThread: false,
                expectedAllowed: true,
            },
            {
                name: "blocks reply in thread for verification requests",
                timelineRenderingType: TimelineRenderingType.Room,
                content: { msgtype: MsgType.KeyVerificationRequest, body: "verify" },
                relation: undefined,
                type: EventType.RoomMessage,
                expectedReplyInThread: false,
                expectedAllowed: true,
            },
            {
                name: "blocks reply in thread for beacon info events",
                timelineRenderingType: TimelineRenderingType.Room,
                content: {},
                relation: undefined,
                type: M_BEACON_INFO.name,
                expectedReplyInThread: false,
                expectedAllowed: true,
            },
            {
                name: "marks non-thread relations as not thread reply allowed",
                timelineRenderingType: TimelineRenderingType.Room,
                content: { msgtype: MsgType.Text, body: "Hello" },
                relation: { rel_type: RelationType.Annotation },
                type: EventType.RoomMessage,
                expectedReplyInThread: true,
                expectedAllowed: false,
            },
        ])("$name", ({ timelineRenderingType, content, relation, type, expectedReplyInThread, expectedAllowed }) => {
            const mxEvent = new MatrixEvent({
                type,
                room_id: roomId,
                sender: userId,
                event_id: "$scenario",
                content,
            });
            vi.spyOn(mxEvent, "getRelation").mockReturnValue(relation as never);

            const vm = createVm({ mxEvent, timelineRenderingType });

            expect(vm.getSnapshot().actions.includes(ActionBarAction.ReplyInThread)).toBe(expectedReplyInThread);
            expect(vm.getSnapshot().isThreadReplyAllowed).toBe(expectedAllowed);
        });

        it("shows thread action for deleted messages with a thread in the room timeline", () => {
            const mxEvent = createMessageEvent();
            vi.mocked(isContentActionable).mockReturnValue(false);
            vi.spyOn(mxEvent, "getThread").mockReturnValue({ rootEvent } as never);

            const vm = createVm({ mxEvent, timelineRenderingType: TimelineRenderingType.Room });

            expect(vm.getSnapshot().actions).toContain(ActionBarAction.ReplyInThread);
            expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Reply);
        });

        it("matches media visibility rules for hide and download actions", async () => {
            vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
            vi.spyOn(MediaEventHelper, "canHide").mockReturnValue(true);
            getHintsForMessageSpy.mockReturnValue({
                allowDownloadingMedia: vi.fn().mockResolvedValue(false),
            } as never);

            const mxEvent = createMessageEvent({
                content: { msgtype: MsgType.Image, body: "Image", file: { url: "mxc://example.org/file" } },
            });
            const vm = createVm({ mxEvent });

            expect(vm.getSnapshot()).toMatchObject({
                isDownloadEncrypted: true,
            });
            expect(vm.getSnapshot().actions).toContain(ActionBarAction.Hide);
            expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download);

            await waitFor(() => expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download));
        });

        it("recomputes parity-relevant flags and resets download state when the event changes", () => {
            vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);

            const vm = createVm({
                mxEvent: createMessageEvent({
                    event_id: "$image",
                    content: { msgtype: MsgType.Image, body: "Image", url: "mxc://example.org/file" },
                }),
            });
            (vm as unknown as { downloadedBlob?: Blob; isDownloadLoading: boolean }).downloadedBlob = new Blob(["x"]);
            (vm as unknown as { downloadedBlob?: Blob; isDownloadLoading: boolean }).isDownloadLoading = true;

            vi.mocked(isContentActionable).mockReturnValue(false);
            vi.spyOn(MediaEventHelper, "isEligible").mockReturnValue(false);

            vm.setProps({
                mxEvent: createMessageEvent({
                    event_id: "$text",
                    content: { msgtype: MsgType.Text, body: "Text" },
                }),
            });

            expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Download);
            expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Hide);
            expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.Reply);
            expect(vm.getSnapshot().actions).not.toContain(ActionBarAction.React);
            expect(vm.getSnapshot().isDownloadLoading).toBe(false);
        });
    });
});
