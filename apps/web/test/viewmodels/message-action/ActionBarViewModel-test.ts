/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import EventEmitter from "events";
import { waitFor } from "@testing-library/dom";
import { mocked } from "jest-mock";
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

import {
    ActionBarViewModel,
    type ActionBarViewModelProps,
} from "../../../src/viewmodels/message-action/ActionBarViewModel";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import defaultDispatcher from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import Resend from "../../../src/Resend";
import PinningUtils from "../../../src/utils/PinningUtils";
import PosthogTrackers from "../../../src/PosthogTrackers";
import Modal from "../../../src/Modal";
import ErrorDialog from "../../../src/components/views/dialogs/ErrorDialog";
import SettingsStore from "../../../src/settings/SettingsStore";
import { ModuleApi } from "../../../src/modules/Api";
import { canCancel, canEditContent, editEvent, isContentActionable } from "../../../src/utils/EventUtils";
import { shouldDisplayReply } from "../../../src/utils/Reply";
import { MediaEventHelper } from "../../../src/utils/MediaEventHelper";
import { getMediaVisibility, setMediaVisibility } from "../../../src/utils/media/mediaVisibility";
import { createTestClient } from "../../test-utils";

jest.mock("../../../src/dispatcher/dispatcher", () => ({
    __esModule: true,
    default: {
        dispatch: jest.fn(),
        register: jest.fn().mockReturnValue("dispatcher-ref"),
        unregister: jest.fn(),
    },
}));

jest.mock("../../../src/Resend", () => ({
    __esModule: true,
    default: {
        resend: jest.fn(),
        removeFromQueue: jest.fn(),
    },
}));

jest.mock("../../../src/PosthogTrackers", () => ({
    __esModule: true,
    default: {
        trackPinUnpinMessage: jest.fn(),
    },
}));

jest.mock("../../../src/Modal", () => ({
    __esModule: true,
    default: {
        createDialog: jest.fn(),
    },
}));

jest.mock("../../../src/languageHandler", () => ({
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

jest.mock("../../../src/utils/EventUtils", () => ({
    canCancel: jest.fn(),
    canEditContent: jest.fn(),
    editEvent: jest.fn(),
    isContentActionable: jest.fn(),
}));

jest.mock("../../../src/utils/PinningUtils", () => ({
    __esModule: true,
    default: {
        canPin: jest.fn(),
        canUnpin: jest.fn(),
        isPinned: jest.fn(),
        pinOrUnpinEvent: jest.fn(),
    },
}));

jest.mock("../../../src/utils/Reply", () => ({
    shouldDisplayReply: jest.fn(),
}));

jest.mock("../../../src/utils/media/mediaVisibility", () => ({
    getMediaVisibility: jest.fn(),
    setMediaVisibility: jest.fn(),
}));

const mockDownload = jest.fn();
jest.mock("../../../src/utils/FileDownloader", () => ({
    FileDownloader: jest.fn().mockImplementation(() => ({
        download: mockDownload,
    })),
}));

describe("ActionBarViewModel", () => {
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
        getLiveTimeline: jest.Mock;
    };
    let getHintsForMessageSpy: jest.SpyInstance;

    const createMessageEvent = (overrides: Partial<ConstructorParameters<typeof MatrixEvent>[0]> = {}): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomMessage,
            room_id: roomId,
            sender: userId,
            event_id: "$event",
            content: { msgtype: MsgType.Text, body: "Hello" },
            ...overrides,
        });

    const createVm = (props: Partial<ActionBarViewModelProps> = {}): ActionBarViewModel => {
        const mxEvent = props.mxEvent ?? createMessageEvent();
        return new ActionBarViewModel({
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
        jest.clearAllMocks();
        client = createTestClient();
        roomState = new EventEmitter();
        room = {
            getLiveTimeline: jest.fn().mockReturnValue({
                getState: jest
                    .fn()
                    .mockImplementation((dir) => (dir === EventTimeline.FORWARDS ? roomState : undefined)),
            }),
        };

        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);
        jest.spyOn(client, "getRoom").mockReturnValue(room as never);
        jest.spyOn(client, "decryptEventIfNeeded");

        jest.spyOn(SettingsStore, "watchSetting").mockImplementation((name, scope) => `${name}:${scope ?? "global"}`);
        jest.spyOn(SettingsStore, "unwatchSetting").mockImplementation(() => {});

        mocked(canCancel).mockImplementation((status) => status === EventStatus.QUEUED);
        mocked(canEditContent).mockReturnValue(true);
        mocked(isContentActionable).mockReturnValue(true);
        mocked(shouldDisplayReply).mockReturnValue(true);
        mocked(getMediaVisibility).mockReturnValue(true);
        mocked(setMediaVisibility).mockResolvedValue(undefined);
        mocked(PinningUtils.canPin).mockReturnValue(false);
        mocked(PinningUtils.canUnpin).mockReturnValue(false);
        mocked(PinningUtils.isPinned).mockReturnValue(false);
        mocked(PinningUtils.pinOrUnpinEvent).mockResolvedValue(undefined);
        jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(false);
        jest.spyOn(MediaEventHelper, "canHide").mockReturnValue(false);
        mockDownload.mockResolvedValue(undefined);

        getHintsForMessageSpy = jest.spyOn(ModuleApi.instance.customComponents, "getHintsForMessage");
        getHintsForMessageSpy.mockReturnValue(null);
    });

    afterEach(() => {
        getHintsForMessageSpy.mockRestore();
        jest.restoreAllMocks();
    });

    it("builds the snapshot for an actionable message", async () => {
        const vm = createVm({ isQuoteExpanded: true });

        await waitFor(() =>
            expect(vm.getSnapshot()).toMatchObject({
                showCancel: false,
                showDownload: false,
                showEdit: true,
                showExpandCollapse: true,
                showHide: false,
                showPinOrUnpin: false,
                showReact: true,
                showReply: true,
                showReplyInThread: true,
                showThreadForDeletedMessage: false,
                isDownloadEncrypted: false,
                isDownloadLoading: false,
                isFailed: false,
                isPinned: false,
                isQuoteExpanded: true,
                isThreadReplyAllowed: true,
            }),
        );
    });

    it("reacts to media download permission hints and room state updates", async () => {
        jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
        jest.spyOn(MediaEventHelper, "canHide").mockReturnValue(true);
        getHintsForMessageSpy.mockReturnValue({
            allowDownloadingMedia: jest.fn().mockResolvedValue(true),
        } as never);

        const vm = createVm({
            mxEvent: createMessageEvent({
                content: { msgtype: MsgType.Image, body: "Image", url: "mxc://example.org/file" },
            }),
        });

        expect(vm.getSnapshot().showDownload).toBe(false);
        expect(vm.getSnapshot().showHide).toBe(true);

        await waitFor(() => expect(vm.getSnapshot().showDownload).toBe(true));

        mocked(PinningUtils.isPinned).mockReturnValue(true);
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

        mocked(getMediaVisibility).mockReturnValue(false);
        roomState.emit(
            RoomStateEvent.Events,
            new MatrixEvent({
                type: EventType.RoomJoinRules,
                room_id: roomId,
                sender: userId,
                content: { join_rule: "public" },
            }),
        );

        expect(vm.getSnapshot().showHide).toBe(false);
    });

    it("ignores stale download permission results after setProps changes the event", async () => {
        jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
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
                    allowDownloadingMedia: jest.fn().mockReturnValue(permissionA.promise),
                } as never;
            }

            if (event === eventB) {
                return {
                    allowDownloadingMedia: jest.fn().mockReturnValue(permissionB.promise),
                } as never;
            }

            return null;
        });

        const vm = createVm({ mxEvent: eventA });
        expect(vm.getSnapshot().showDownload).toBe(false);

        vm.setProps({ mxEvent: eventB });
        permissionA.resolve(true);
        await Promise.resolve();

        expect(vm.getSnapshot().showDownload).toBe(false);

        permissionB.resolve(false);
        await Promise.resolve();

        expect(vm.getSnapshot().showDownload).toBe(false);
    });

    it("refreshes on event status changes and removes listeners on dispose", () => {
        const mxEvent = createMessageEvent();
        const offSpy = jest.spyOn(mxEvent, "off");
        const roomStateOffSpy = jest.spyOn(roomState, "off");
        const vm = createVm({ mxEvent });

        expect(vm.getSnapshot().showCancel).toBe(false);

        mxEvent.setStatus(EventStatus.QUEUED);

        expect(vm.getSnapshot().showCancel).toBe(true);
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

        jest.spyOn(mxEvent, "localRedactionEvent").mockReturnValue(localRedactionEvent);
        jest.spyOn(mxEvent, "replacingEvent").mockReturnValue(replacingEvent);

        const vm = createVm({ mxEvent });

        vm.onResendClick(null);
        vm.onCancelClick(null);

        expect(Resend.resend).toHaveBeenCalledWith(client, localRedactionEvent);
        expect(Resend.removeFromQueue).toHaveBeenCalledWith(client, replacingEvent);
    });

    it("downloads a cached blob and shows an error dialog on failure", async () => {
        const blob = new Blob(["downloaded"]);
        jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);

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
        jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
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
        jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
        const permission = createPendingPromise<boolean>();
        const event = createMessageEvent({
            event_id: "$eventA",
            content: { msgtype: MsgType.Image, body: "Image A", url: "mxc://example.org/a" },
        });

        getHintsForMessageSpy.mockReturnValue({
            allowDownloadingMedia: jest.fn().mockReturnValue(permission.promise),
        } as never);

        const vm = createVm({ mxEvent: event });
        expect(vm.getSnapshot().showDownload).toBe(false);

        vm.dispose();
        permission.resolve(true);
        await Promise.resolve();

        expect(vm.getSnapshot().showDownload).toBe(false);
    });

    it("dispatches reply and thread actions and forwards callbacks", async () => {
        const onOptionsClick = jest.fn();
        const onReactionsClick = jest.fn();
        const onToggleThreadExpanded = jest.fn();
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
        jest.spyOn(threadReply, "getThread").mockReturnValue({ rootEvent } as never);

        const vm = createVm({
            mxEvent: threadReply,
            isCard: true,
            onOptionsClick,
            onReactionsClick,
            onToggleThreadExpanded,
        });
        mocked(PinningUtils.isPinned).mockReturnValue(false);

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
                expected: { showReply: false, showReact: false },
            },
            {
                name: "hides reply when sending messages is disabled",
                actionable: true,
                props: { canSendMessages: false },
                expected: { showReply: false, showReact: true },
            },
            {
                name: "hides react when reactions are disabled",
                actionable: true,
                props: { canReact: false },
                expected: { showReply: true, showReact: false },
            },
            {
                name: "hides react in search results",
                actionable: true,
                props: { isSearch: true },
                expected: { showReply: true, showReact: false },
            },
        ])("$name", ({ actionable, props, expected }) => {
            mocked(isContentActionable).mockReturnValue(actionable);

            const vm = createVm(props);

            expect(vm.getSnapshot()).toMatchObject(expected);
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
            mocked(shouldDisplayReply).mockReturnValue(displayReply);

            const vm = createVm({ isQuoteExpanded: quoteExpanded });

            expect(vm.getSnapshot().showExpandCollapse).toBe(expected);
        });

        it.each([
            {
                name: "allows reply in thread for normal room messages in room timeline",
                timelineRenderingType: TimelineRenderingType.Room,
                content: { msgtype: MsgType.Text, body: "Hello" },
                relation: undefined,
                type: EventType.RoomMessage,
                expected: { showReplyInThread: true, isThreadReplyAllowed: true },
            },
            {
                name: "blocks reply in thread in thread timeline",
                timelineRenderingType: TimelineRenderingType.Thread,
                content: { msgtype: MsgType.Text, body: "Hello" },
                relation: undefined,
                type: EventType.RoomMessage,
                expected: { showReplyInThread: false, isThreadReplyAllowed: true },
            },
            {
                name: "blocks reply in thread for verification requests",
                timelineRenderingType: TimelineRenderingType.Room,
                content: { msgtype: MsgType.KeyVerificationRequest, body: "verify" },
                relation: undefined,
                type: EventType.RoomMessage,
                expected: { showReplyInThread: false, isThreadReplyAllowed: true },
            },
            {
                name: "blocks reply in thread for beacon info events",
                timelineRenderingType: TimelineRenderingType.Room,
                content: {},
                relation: undefined,
                type: M_BEACON_INFO.name,
                expected: { showReplyInThread: false, isThreadReplyAllowed: true },
            },
            {
                name: "marks non-thread relations as not thread reply allowed",
                timelineRenderingType: TimelineRenderingType.Room,
                content: { msgtype: MsgType.Text, body: "Hello" },
                relation: { rel_type: RelationType.Annotation },
                type: EventType.RoomMessage,
                expected: { showReplyInThread: true, isThreadReplyAllowed: false },
            },
        ])("$name", ({ timelineRenderingType, content, relation, type, expected }) => {
            const mxEvent = new MatrixEvent({
                type,
                room_id: roomId,
                sender: userId,
                event_id: "$scenario",
                content,
            });
            jest.spyOn(mxEvent, "getRelation").mockReturnValue(relation as never);

            const vm = createVm({ mxEvent, timelineRenderingType });

            expect(vm.getSnapshot()).toMatchObject(expected);
        });

        it("shows thread action for deleted messages with a thread in the room timeline", () => {
            const mxEvent = createMessageEvent();
            mocked(isContentActionable).mockReturnValue(false);
            jest.spyOn(mxEvent, "getThread").mockReturnValue({ rootEvent } as never);

            const vm = createVm({ mxEvent, timelineRenderingType: TimelineRenderingType.Room });

            expect(vm.getSnapshot().showThreadForDeletedMessage).toBe(true);
            expect(vm.getSnapshot().showReply).toBe(false);
        });

        it("matches media visibility rules for hide and download actions", async () => {
            jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);
            jest.spyOn(MediaEventHelper, "canHide").mockReturnValue(true);
            getHintsForMessageSpy.mockReturnValue({
                allowDownloadingMedia: jest.fn().mockResolvedValue(false),
            } as never);

            const mxEvent = createMessageEvent({
                content: { msgtype: MsgType.Image, body: "Image", file: { url: "mxc://example.org/file" } },
            });
            const vm = createVm({ mxEvent });

            expect(vm.getSnapshot()).toMatchObject({
                showHide: true,
                showDownload: false,
                isDownloadEncrypted: true,
            });

            await waitFor(() =>
                expect(vm.getSnapshot()).toMatchObject({
                    showHide: true,
                    showDownload: false,
                    isDownloadEncrypted: true,
                }),
            );
        });

        it("recomputes parity-relevant flags and resets download state when the event changes", () => {
            jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(true);

            const vm = createVm({
                mxEvent: createMessageEvent({
                    event_id: "$image",
                    content: { msgtype: MsgType.Image, body: "Image", url: "mxc://example.org/file" },
                }),
            });
            (vm as unknown as { downloadedBlob?: Blob; isDownloadLoading: boolean }).downloadedBlob = new Blob(["x"]);
            (vm as unknown as { downloadedBlob?: Blob; isDownloadLoading: boolean }).isDownloadLoading = true;

            mocked(isContentActionable).mockReturnValue(false);
            jest.spyOn(MediaEventHelper, "isEligible").mockReturnValue(false);

            vm.setProps({
                mxEvent: createMessageEvent({
                    event_id: "$text",
                    content: { msgtype: MsgType.Text, body: "Text" },
                }),
            });

            expect(vm.getSnapshot()).toMatchObject({
                showDownload: false,
                showHide: false,
                showReply: false,
                showReact: false,
                isDownloadLoading: false,
            });
        });
    });
});
