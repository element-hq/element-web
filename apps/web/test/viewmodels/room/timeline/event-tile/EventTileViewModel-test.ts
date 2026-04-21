/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import {
    EventStatus,
    type IEventDecryptionResult,
    MatrixEvent,
    PendingEventOrdering,
    Room,
    RoomEvent,
    type Thread,
    ThreadEvent,
    TweakName,
} from "matrix-js-sdk/src/matrix";
import {
    type CryptoApi,
    DecryptionFailureCode,
    type EventEncryptionInfo,
    EventShieldColour,
    EventShieldReason,
} from "matrix-js-sdk/src/crypto-api";
import { mkEncryptedMatrixEvent } from "matrix-js-sdk/src/testing";

import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { Action } from "../../../../../src/dispatcher/actions";
import {
    AvatarSubject,
    ClickMode,
    EventTileRenderMode,
    EncryptionIndicatorMode,
    PadlockMode,
    SenderMode,
    ThreadPanelMode,
    TimestampDisplayMode,
    ThreadInfoMode,
} from "../../../../../src/models/rooms/EventTileModel";
import {
    EventTileViewModel,
    type EventTileViewModelProps,
} from "../../../../../src/viewmodels/room/timeline/event-tile/EventTileViewModel";
import { TimelineRenderingType } from "../../../../../src/contexts/RoomContext";
import { Layout } from "../../../../../src/settings/enums/Layout";
import { _t } from "../../../../../src/languageHandler";
import { filterConsole, flushPromises, mkEvent, mkMessage, stubClient } from "../../../../test-utils";
import { mkThread } from "../../../../test-utils/threads";

jest.mock("../../../../../src/utils/EventRenderingUtils", () => ({
    ...jest.requireActual("../../../../../src/utils/EventRenderingUtils"),
    getEventDisplayInfo: jest.fn(),
}));

const mockGetEventDisplayInfo = jest.requireMock("../../../../../src/utils/EventRenderingUtils")
    .getEventDisplayInfo as jest.Mock;

describe("EventTileViewModel", () => {
    const ROOM_ID = "!roomId:example.org";
    let mxEvent: MatrixEvent;
    let room: Room;
    let client: ReturnType<typeof MatrixClientPeg.safeGet>;
    let commandDeps: EventTileViewModelProps["commandDeps"];

    const createdViewModels: EventTileViewModel[] = [];

    function makeProps(overrides: Partial<EventTileViewModelProps> = {}): EventTileViewModelProps {
        return {
            cli: client,
            mxEvent,
            timelineRenderingType: TimelineRenderingType.Room,
            isRoomEncrypted: false,
            showHiddenEvents: false,
            commandDeps,
            ...overrides,
        };
    }

    function createViewModel(overrides: Partial<EventTileViewModelProps> = {}): EventTileViewModel {
        const vm = new EventTileViewModel(makeProps(overrides));
        vm.refreshVerification();
        createdViewModels.push(vm);
        return vm;
    }

    beforeEach(() => {
        jest.clearAllMocks();

        stubClient();
        client = MatrixClientPeg.safeGet();

        room = new Room(ROOM_ID, client, client.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
            timelineSupport: true,
        });

        jest.spyOn(client, "getRoom").mockReturnValue(room);
        jest.spyOn(client, "decryptEventIfNeeded").mockResolvedValue();
        commandDeps = {
            dispatch: jest.fn(),
            copyPlaintext: jest.fn().mockResolvedValue(true),
            trackInteraction: jest.fn(),
            allowOverridingNativeContextMenus: jest.fn().mockReturnValue(true),
        };

        mxEvent = mkMessage({
            room: room.roomId,
            user: "@alice:example.org",
            msg: "Hello world!",
            event: true,
        });

        mockGetEventDisplayInfo.mockReturnValue({
            hasRenderer: true,
            isBubbleMessage: false,
            isInfoMessage: false,
            isLeftAlignedBubbleMessage: false,
            noBubbleEvent: false,
            isSeeingThroughMessageHiddenForModeration: false,
        });
    });

    afterEach(() => {
        for (const vm of createdViewModels.splice(0)) {
            vm.dispose();
        }
    });

    describe("click and sender modes", () => {
        it.each([
            [TimelineRenderingType.Notification, ClickMode.ViewRoom],
            [TimelineRenderingType.ThreadsList, ClickMode.ShowThread],
            [TimelineRenderingType.Room, ClickMode.None],
        ])("sets tile click mode for %s", (timelineRenderingType, tileClickMode) => {
            const vm = createViewModel({ timelineRenderingType });

            expect(vm.getSnapshot().tileClickMode).toBe(tileClickMode);
        });

        it.each([
            [TimelineRenderingType.Room, SenderMode.ComposerInsert],
            [TimelineRenderingType.Search, SenderMode.ComposerInsert],
            [TimelineRenderingType.ThreadsList, SenderMode.Tooltip],
            [TimelineRenderingType.Notification, SenderMode.Default],
        ])("sets sender mode for %s", (timelineRenderingType, senderMode) => {
            const vm = createViewModel({ timelineRenderingType });

            expect(vm.getSnapshot().senderMode).toBe(senderMode);
        });

        it("hides the sender when hideSender is set", () => {
            const vm = createViewModel({ hideSender: true });

            expect(vm.getSnapshot().senderMode).toBe(SenderMode.Hidden);
        });

        it("marks tiles as opened from search in search view", () => {
            const vm = createViewModel({ timelineRenderingType: TimelineRenderingType.Search });

            expect(vm.getSnapshot().openedFromSearch).toBe(true);
        });

        it("does not show a reply preview for non-reply events", () => {
            const vm = createViewModel();

            expect(vm.getSnapshot().showReplyPreview).toBe(false);
        });

        it("shows a reply preview for reply events", () => {
            mxEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "Reply",
                event: true,
                relatesTo: {
                    "m.in_reply_to": {
                        event_id: "$parent",
                    },
                },
            });

            const vm = createViewModel({ mxEvent });

            expect(vm.getSnapshot().showReplyPreview).toBe(true);
            expect(vm.getSnapshot().shouldRenderReplyPreview).toBe(true);
        });

        it("does not render the reply preview when no renderer exists", () => {
            mxEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "Reply",
                event: true,
                relatesTo: {
                    "m.in_reply_to": {
                        event_id: "$parent",
                    },
                },
            });

            mockGetEventDisplayInfo.mockReturnValue({
                hasRenderer: false,
                isBubbleMessage: false,
                isInfoMessage: false,
                isLeftAlignedBubbleMessage: false,
                noBubbleEvent: false,
                isSeeingThroughMessageHiddenForModeration: false,
            });

            const vm = createViewModel({ mxEvent });

            expect(vm.getSnapshot().showReplyPreview).toBe(true);
            expect(vm.getSnapshot().shouldRenderReplyPreview).toBe(false);
        });

        it("does not recompute display info for hover-only updates", () => {
            const vm = createViewModel();
            const initialDisplayInfoCalls = mockGetEventDisplayInfo.mock.calls.length;

            vm.setHover(true);
            vm.setHover(false);

            expect(mockGetEventDisplayInfo).toHaveBeenCalledTimes(initialDisplayInfoCalls);
        });

        it("uses the target avatar subject for third-party invite events", () => {
            mxEvent = mkEvent({
                event: true,
                type: "m.room.member",
                user: "@alice:example.org",
                room: room.roomId,
                content: {
                    third_party_invite: {
                        display_name: "Bob",
                    },
                },
            });

            const vm = createViewModel({ mxEvent });

            expect(vm.getSnapshot().avatarSubject).toBe(AvatarSubject.Target);
        });

        it("keeps avatar clicks enabled for info-message avatars in room timelines", () => {
            mxEvent = mkEvent({
                event: true,
                type: "m.room.member",
                user: "@alice:example.org",
                room: room.roomId,
                content: {
                    membership: "join",
                },
            });

            mockGetEventDisplayInfo.mockReturnValue({
                hasRenderer: true,
                isBubbleMessage: false,
                isInfoMessage: true,
                isLeftAlignedBubbleMessage: false,
                noBubbleEvent: false,
                isSeeingThroughMessageHiddenForModeration: false,
            });

            const vm = createViewModel({ mxEvent });

            expect(vm.getSnapshot().avatarMemberUserOnClick).toBe(true);
        });

        it("uses the missing renderer fallback mode for non-notification tiles without a renderer", () => {
            mockGetEventDisplayInfo.mockReturnValue({
                hasRenderer: false,
                isBubbleMessage: false,
                isInfoMessage: false,
                isLeftAlignedBubbleMessage: false,
                noBubbleEvent: false,
                isSeeingThroughMessageHiddenForModeration: false,
            });

            const vm = createViewModel();

            expect(vm.getSnapshot().renderMode).toBe(EventTileRenderMode.MissingRendererFallback);
        });

        it("keeps notification tiles in rendered mode even without a renderer", () => {
            mockGetEventDisplayInfo.mockReturnValue({
                hasRenderer: false,
                isBubbleMessage: false,
                isInfoMessage: false,
                isLeftAlignedBubbleMessage: false,
                noBubbleEvent: false,
                isSeeingThroughMessageHiddenForModeration: false,
            });

            const vm = createViewModel({ timelineRenderingType: TimelineRenderingType.Notification });

            expect(vm.getSnapshot().renderMode).toBe(EventTileRenderMode.Rendered);
        });
    });

    describe("thread and timestamp modes", () => {
        it("shows thread summary mode for a thread root", () => {
            const { rootEvent } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@bob:example.org"],
                length: 2,
            });

            const vm = createViewModel({ mxEvent: rootEvent });

            expect(vm.getSnapshot().threadInfoMode).toBe(ThreadInfoMode.Summary);
        });

        it("shows search link thread info mode for threaded search results with a highlight link", () => {
            const searchResult = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "search result",
                event: true,
            });
            Object.defineProperty(searchResult, "threadRootId", { value: "$thread-root" });

            const vm = createViewModel({
                mxEvent: searchResult,
                timelineRenderingType: TimelineRenderingType.Search,
                highlightLink: "#event",
            });

            expect(vm.getSnapshot().threadInfoMode).toBe(ThreadInfoMode.SearchLink);
            expect(vm.getSnapshot().threadInfoHref).toBe("#event");
            expect(vm.getSnapshot().threadInfoLabel).toBe(_t("timeline|thread_info_basic"));
        });

        it("shows search text thread info mode for threaded search results without a highlight link", () => {
            const searchResult = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "search result",
                event: true,
            });
            Object.defineProperty(searchResult, "threadRootId", { value: "$thread-root" });

            const vm = createViewModel({
                mxEvent: searchResult,
                timelineRenderingType: TimelineRenderingType.Search,
            });

            expect(vm.getSnapshot().threadInfoMode).toBe(ThreadInfoMode.SearchText);
            expect(vm.getSnapshot().threadInfoHref).toBeUndefined();
            expect(vm.getSnapshot().threadInfoLabel).toBe(_t("timeline|thread_info_basic"));
        });

        it("shows timestamps when alwaysShowTimestamps is set", () => {
            const timestampedEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "timestamped",
                event: true,
                ts: 123,
            });
            const vm = createViewModel({ mxEvent: timestampedEvent, alwaysShowTimestamps: true });

            expect(vm.getSnapshot().showTimestamp).toBe(true);
            expect(vm.getSnapshot().timestampDisplayMode).toBe(TimestampDisplayMode.Linked);
        });

        it("suppresses timestamps when hideTimestamp is set", () => {
            const vm = createViewModel({ alwaysShowTimestamps: true, hideTimestamp: true });

            expect(vm.getSnapshot().showTimestamp).toBe(false);
            expect(vm.getSnapshot().timestampDisplayMode).toBe(TimestampDisplayMode.Hidden);
        });

        it("uses the latest reply timestamp for thread list tiles", () => {
            const rootEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "root",
                event: true,
                ts: 100,
            });
            jest.spyOn(rootEvent, "getThread").mockReturnValue({
                id: "$thread",
                length: 2,
                replyToEvent: {
                    getTs: () => 101,
                    getId: () => "$reply",
                },
            } as never);

            const vm = createViewModel({
                mxEvent: rootEvent,
                timelineRenderingType: TimelineRenderingType.ThreadsList,
            });

            expect(vm.getSnapshot().timestampTs).toBe(101);
        });

        it("does not show timestamps by default for thread list tiles", () => {
            const timestampedEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "timestamped",
                event: true,
                ts: 123,
            });
            const vm = createViewModel({
                mxEvent: timestampedEvent,
                timelineRenderingType: TimelineRenderingType.ThreadsList,
            });

            expect(vm.getSnapshot().showTimestamp).toBe(false);
            expect(vm.getSnapshot().timestampDisplayMode).toBe(TimestampDisplayMode.Hidden);
        });

        it("uses plain timestamp mode for thread list tiles when timestamps are shown", () => {
            const timestampedEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "timestamped",
                event: true,
                ts: 123,
            });
            const vm = createViewModel({
                mxEvent: timestampedEvent,
                timelineRenderingType: TimelineRenderingType.ThreadsList,
            });

            vm.setHover(true);

            expect(vm.getSnapshot().showTimestamp).toBe(true);
            expect(vm.getSnapshot().timestampDisplayMode).toBe(TimestampDisplayMode.Plain);
        });

        it("uses plain timestamp mode for file tiles when timestamps are shown", () => {
            const timestampedEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "timestamped",
                event: true,
                ts: 123,
            });
            const vm = createViewModel({
                mxEvent: timestampedEvent,
                timelineRenderingType: TimelineRenderingType.File,
                alwaysShowTimestamps: true,
            });

            expect(vm.getSnapshot().showTimestamp).toBe(true);
            expect(vm.getSnapshot().timestampDisplayMode).toBe(TimestampDisplayMode.Plain);
        });
    });

    describe("interaction state", () => {
        function createTimestampedViewModel(): EventTileViewModel {
            const timestampedEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "timestamped",
                event: true,
                ts: 123,
            });

            return createViewModel({ mxEvent: timestampedEvent });
        }

        it("shows and hides timestamps when hover changes", () => {
            const vm = createTimestampedViewModel();

            expect(vm.getSnapshot().showTimestamp).toBe(false);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(false);

            vm.setHover(true);
            expect(vm.getSnapshot().hover).toBe(true);
            expect(vm.getSnapshot().showTimestamp).toBe(true);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(true);

            vm.setHover(false);
            expect(vm.getSnapshot().hover).toBe(false);
            expect(vm.getSnapshot().showTimestamp).toBe(false);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(false);
        });

        it("shows timestamps when focus enters the tile", () => {
            const vm = createTimestampedViewModel();

            vm.onFocusEnter(false);

            expect(vm.getSnapshot().focusWithin).toBe(true);
            expect(vm.getSnapshot().showTimestamp).toBe(true);
        });

        it("shows the action bar when focus enters via keyboard", () => {
            const vm = createTimestampedViewModel();

            vm.onFocusEnter(true);

            expect(vm.getSnapshot().showActionBarFromFocus).toBe(true);
            expect(vm.getSnapshot().focusWithin).toBe(true);
            expect(vm.getSnapshot().showTimestamp).toBe(true);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(true);
        });

        it("shows timestamps when the action bar is focused", () => {
            const vm = createTimestampedViewModel();

            vm.onActionBarFocusChange(true, false);

            expect(vm.getSnapshot().actionBarFocused).toBe(true);
            expect(vm.getSnapshot().showTimestamp).toBe(true);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(true);
        });

        it("keeps action bar focus in sync with the context menu state", () => {
            const vm = createTimestampedViewModel();

            vm.onContextMenuOpen();

            expect(vm.getSnapshot().isContextMenuOpen).toBe(true);
            expect(vm.getSnapshot().actionBarFocused).toBe(true);
            expect(vm.getSnapshot().showTimestamp).toBe(true);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(false);

            vm.onContextMenuClose();

            expect(vm.getSnapshot().isContextMenuOpen).toBe(false);
            expect(vm.getSnapshot().actionBarFocused).toBe(false);
            expect(vm.getSnapshot().showTimestamp).toBe(false);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(false);
        });

        it("preserves keyboard-triggered action bar visibility when the context menu closes", () => {
            const vm = createTimestampedViewModel();

            vm.onFocusEnter(true);
            vm.onContextMenuOpen();
            vm.onContextMenuClose();

            expect(vm.getSnapshot().showActionBarFromFocus).toBe(true);
            expect(vm.getSnapshot().actionBarFocused).toBe(false);
            expect(vm.getSnapshot().isContextMenuOpen).toBe(false);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(true);
        });

        it("applies focus enter and leave as a single VM transition", () => {
            const vm = createTimestampedViewModel();

            vm.onFocusEnter(true);

            expect(vm.getSnapshot().focusWithin).toBe(true);
            expect(vm.getSnapshot().showActionBarFromFocus).toBe(true);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(true);

            vm.onFocusLeave();

            expect(vm.getSnapshot().focusWithin).toBe(false);
            expect(vm.getSnapshot().showActionBarFromFocus).toBe(false);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(false);
        });

        it("resets hover when action bar focus is lost through the VM helper", () => {
            const vm = createTimestampedViewModel();

            vm.setHover(true);
            vm.onActionBarFocusChange(true, true);

            expect(vm.getSnapshot().actionBarFocused).toBe(true);
            expect(vm.getSnapshot().hover).toBe(true);

            vm.onActionBarFocusChange(false, false);

            expect(vm.getSnapshot().actionBarFocused).toBe(false);
            expect(vm.getSnapshot().hover).toBe(false);
            expect(vm.getSnapshot().shouldRenderActionBar).toBe(false);
        });

        it("opens and closes the context menu through VM helpers", () => {
            const vm = createTimestampedViewModel();

            vm.onContextMenuOpen();

            expect(vm.getSnapshot().isContextMenuOpen).toBe(true);
            expect(vm.getSnapshot().actionBarFocused).toBe(true);
            expect(vm.getSnapshot().hover).toBe(false);

            vm.onContextMenuClose();

            expect(vm.getSnapshot().isContextMenuOpen).toBe(false);
            expect(vm.getSnapshot().actionBarFocused).toBe(false);
            expect(vm.getSnapshot().hover).toBe(false);
        });

        it("stores and clears context menu state through VM command helpers", () => {
            const vm = createTimestampedViewModel();
            const target = document.createElement("div");

            vm.openContextMenu({
                clientX: 10,
                clientY: 20,
                target,
                preventDefault: jest.fn(),
                stopPropagation: jest.fn(),
            });

            expect(vm.getSnapshot().contextMenuState).toEqual({
                position: { left: 10, top: 20, bottom: 20 },
                link: undefined,
            });
            expect(vm.getSnapshot().isContextMenuOpen).toBe(true);

            vm.closeContextMenu();

            expect(vm.getSnapshot().contextMenuState).toBeUndefined();
            expect(vm.getSnapshot().isContextMenuOpen).toBe(false);
        });

        it("tracks quote expansion state", () => {
            const vm = createViewModel();

            vm.setQuoteExpanded(true);
            expect(vm.getSnapshot().isQuoteExpanded).toBe(true);

            vm.setQuoteExpanded(false);
            expect(vm.getSnapshot().isQuoteExpanded).toBe(false);
        });

        it("toggles quote expansion through the dedicated VM helper", () => {
            const vm = createViewModel();

            vm.toggleQuoteExpanded();
            expect(vm.getSnapshot().isQuoteExpanded).toBe(true);

            vm.toggleQuoteExpanded();
            expect(vm.getSnapshot().isQuoteExpanded).toBe(false);
        });
    });

    describe("command methods", () => {
        it("dispatches room navigation from permalink clicks", () => {
            const vm = createViewModel({ timelineRenderingType: TimelineRenderingType.Search });
            const preventDefault = jest.fn();

            vm.onPermalinkClicked({ preventDefault });

            expect(preventDefault).toHaveBeenCalled();
            expect(commandDeps.dispatch).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                event_id: mxEvent.getId(),
                highlighted: true,
                room_id: mxEvent.getRoomId(),
                metricsTrigger: "MessageSearch",
            });
        });

        it("copies the thread permalink through the VM", async () => {
            const permalinkCreator = {
                forEvent: jest.fn().mockReturnValue("https://example.org/#/room/$event"),
            } as any;
            const vm = createViewModel({ permalinkCreator });

            await vm.copyLinkToThread();

            expect(permalinkCreator.forEvent).toHaveBeenCalledWith(mxEvent.getId());
            expect(commandDeps.copyPlaintext).toHaveBeenCalledWith("https://example.org/#/room/$event");
        });

        it("dispatches thread opening and tracking for thread list clicks", () => {
            const vm = createViewModel({ timelineRenderingType: TimelineRenderingType.ThreadsList });
            const event = new Event("click");

            vm.onListTileClick(event, 3);

            expect(commandDeps.dispatch).toHaveBeenCalledWith({
                action: Action.ShowThread,
                rootEvent: mxEvent,
                push: true,
            });
            expect(commandDeps.trackInteraction).toHaveBeenCalledWith("WebThreadsPanelThreadItem", event, 3);
        });
    });

    describe("presentational snapshot fields", () => {
        it("derives root and content class names in the snapshot", () => {
            const vm = createViewModel();

            expect(vm.getSnapshot().eventId).toBe(mxEvent.getId());
            expect(vm.getSnapshot().ariaLive).toBe("off");
            expect(vm.getSnapshot().rootClassName).toContain("mx_EventTile");
            expect(vm.getSnapshot().contentClassName).toBe("mx_EventTile_line");
            expect(vm.getSnapshot().timestampView.permalink).toBe(vm.getSnapshot().permalink);
            expect(vm.getSnapshot().timestampView.ts).toBe(vm.getSnapshot().timestampTs);
            expect(vm.getSnapshot().encryptionView.mode).toBe(vm.getSnapshot().encryptionIndicatorMode);
        });

        it("marks missing-renderer fallback directly in the snapshot", () => {
            mockGetEventDisplayInfo.mockReturnValue({
                hasRenderer: false,
                isBubbleMessage: false,
                isInfoMessage: false,
                isLeftAlignedBubbleMessage: false,
                noBubbleEvent: false,
                isSeeingThroughMessageHiddenForModeration: false,
            });

            const vm = createViewModel();

            expect(vm.getSnapshot().shouldRenderMissingRendererFallback).toBe(true);
        });

        it("derives the encryption indicator title for unencrypted events in encrypted rooms", () => {
            const vm = createViewModel({ isRoomEncrypted: true });

            expect(vm.getSnapshot().encryptionIndicatorTitle).toBe(_t("common|unencrypted"));
        });

        it("derives notification list flags and room name", () => {
            const vm = createViewModel({ timelineRenderingType: TimelineRenderingType.Notification });

            expect(vm.getSnapshot().isNotification).toBe(true);
            expect(vm.getSnapshot().isListLikeTile).toBe(true);
            expect(vm.getSnapshot().notificationRoomName).toBe(room.name);
            expect(vm.getSnapshot().notificationView).toEqual({
                enabled: true,
                roomName: room.name,
            });
        });
    });

    describe("padlock and receipts", () => {
        it("shows the group padlock for non-IRC layouts", () => {
            const vm = createViewModel({ layout: Layout.Group });

            expect(vm.getSnapshot().padlockMode).toBe(PadlockMode.Group);
        });

        it("shows the IRC padlock for IRC layout", () => {
            const vm = createViewModel({ layout: Layout.IRC });

            expect(vm.getSnapshot().padlockMode).toBe(PadlockMode.Irc);
        });

        it("shows the thread toolbar in the thread list", () => {
            const vm = createViewModel({ timelineRenderingType: TimelineRenderingType.ThreadsList });

            expect(vm.getSnapshot().threadPanelMode).toBe(ThreadPanelMode.Toolbar);
            expect(vm.getSnapshot().shouldRenderThreadToolbar).toBe(true);
            expect(vm.getSnapshot().shouldRenderThreadPreview).toBe(false);
            expect(vm.getSnapshot().threadReplyCount).toBeUndefined();
        });

        it("shows read receipts when enabled and no sending state takes priority", () => {
            const vm = createViewModel({
                showReadReceipts: true,
                readReceipts: [{ userId: "@bob:example.org", ts: 1, roomMember: null }],
            });

            expect(vm.getSnapshot().showReadReceipts).toBe(true);
        });

        it("does not recompute display info for receipt-only updates", () => {
            mxEvent = mkMessage({
                room: room.roomId,
                user: client.getSafeUserId(),
                msg: "Hello world!",
                event: true,
            });

            createViewModel({
                mxEvent,
                lastSuccessful: true,
            });
            const initialDisplayInfoCalls = mockGetEventDisplayInfo.mock.calls.length;

            client.emit(RoomEvent.Receipt, mxEvent, room);

            expect(mockGetEventDisplayInfo).toHaveBeenCalledTimes(initialDisplayInfoCalls);
        });

        it("shows the thread panel summary for notifications with a thread", () => {
            const { rootEvent } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@bob:example.org"],
                length: 2,
            });

            const vm = createViewModel({
                mxEvent: rootEvent,
                timelineRenderingType: TimelineRenderingType.Notification,
            });

            expect(vm.getSnapshot().threadPanelMode).toBe(ThreadPanelMode.Summary);
            expect(vm.getSnapshot().shouldRenderThreadPreview).toBe(true);
            expect(vm.getSnapshot().shouldRenderThreadToolbar).toBe(false);
            expect(vm.getSnapshot().threadReplyCount).toBe(vm.getSnapshot().thread?.length);
        });

        it("shows the thread summary and toolbar in the thread list when a thread is present", () => {
            const { rootEvent } = mkThread({
                room,
                client,
                authorId: "@alice:example.org",
                participantUserIds: ["@bob:example.org"],
                length: 2,
            });

            const vm = createViewModel({
                mxEvent: rootEvent,
                timelineRenderingType: TimelineRenderingType.ThreadsList,
            });

            expect(vm.getSnapshot().threadPanelMode).toBe(ThreadPanelMode.SummaryWithToolbar);
            expect(vm.getSnapshot().shouldRenderThreadPreview).toBe(true);
            expect(vm.getSnapshot().shouldRenderThreadToolbar).toBe(true);
            expect(vm.getSnapshot().threadReplyCount).toBe(vm.getSnapshot().thread?.length);
        });

        it("does not show a footer for redacted events with reactions", () => {
            const vm = createViewModel({
                isRedacted: true,
                showReactions: true,
                getRelationsForEvent: jest.fn().mockReturnValue({} as never),
            });

            expect(vm.getSnapshot().hasFooter).toBe(false);
        });

        it("shares a single room thread listener across many tile view models", () => {
            const roomOnSpy = jest.spyOn(room, "on");
            const roomOffSpy = jest.spyOn(room, "off");
            const viewModels = Array.from({ length: 101 }, (_, index) =>
                createViewModel({
                    mxEvent: mkMessage({
                        room: room.roomId,
                        user: "@alice:example.org",
                        msg: `Message ${index}`,
                        event: true,
                    }),
                }),
            );

            expect(roomOnSpy).toHaveBeenCalledTimes(1);
            expect(roomOnSpy).toHaveBeenCalledWith(ThreadEvent.New, expect.any(Function));

            viewModels.slice(0, -1).forEach((vm) => vm.dispose());
            expect(roomOffSpy).not.toHaveBeenCalledWith(ThreadEvent.New, expect.any(Function));

            viewModels.at(-1)?.dispose();
            expect(roomOffSpy).toHaveBeenCalledTimes(1);
            expect(roomOffSpy).toHaveBeenCalledWith(ThreadEvent.New, expect.any(Function));
        });

        it("only updates the tile waiting on the matching new thread root", () => {
            const matchingEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "Matching root",
                event: true,
            });
            const otherEvent = mkMessage({
                room: room.roomId,
                user: "@alice:example.org",
                msg: "Other root",
                event: true,
            });
            const matchingVm = createViewModel({ mxEvent: matchingEvent });
            const otherVm = createViewModel({ mxEvent: otherEvent });
            const thread = {
                id: matchingEvent.getId(),
                length: 3,
                replyToEvent: null,
            } as unknown as Thread;

            room.emit(ThreadEvent.New, thread, false);

            expect(matchingVm.getSnapshot().thread).toBe(thread);
            expect(otherVm.getSnapshot().thread).toBeNull();
        });

        it("shares a single trust listener across many tile view models", () => {
            const cliOnSpy = jest.spyOn(client, "on");
            const cliOffSpy = jest.spyOn(client, "off");
            const viewModels = Array.from({ length: 11 }, (_, index) =>
                createViewModel({
                    mxEvent: mkMessage({
                        room: room.roomId,
                        user: `@user${index}:example.org`,
                        msg: `Message ${index}`,
                        event: true,
                    }),
                }),
            );

            expect(cliOnSpy).toHaveBeenCalledTimes(1);
            expect(cliOnSpy).toHaveBeenCalledWith("userTrustStatusChanged", expect.any(Function));

            viewModels.slice(0, -1).forEach((vm) => vm.dispose());
            expect(cliOffSpy).not.toHaveBeenCalledWith("userTrustStatusChanged", expect.any(Function));

            viewModels.at(-1)?.dispose();
            expect(cliOffSpy).toHaveBeenCalledTimes(1);
            expect(cliOffSpy).toHaveBeenCalledWith("userTrustStatusChanged", expect.any(Function));
        });
    });

    describe("event verification", () => {
        const eventToEncryptionInfoMap = new Map<string, EventEncryptionInfo>();

        beforeEach(() => {
            eventToEncryptionInfoMap.clear();

            const mockCrypto = {
                getEncryptionInfoForEvent: async (event: MatrixEvent) => eventToEncryptionInfoMap.get(event.getId()!)!,
            } as unknown as CryptoApi;
            client.getCrypto = () => mockCrypto;
        });

        it("shows a warning for an event from an unverified device", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.RED,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            } as EventEncryptionInfo);

            const vm = createViewModel();
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EncryptionIndicatorMode.Warning,
                shieldReason: EventShieldReason.UNSIGNED_DEVICE,
            });
        });

        it("shows no shield for a verified event", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const vm = createViewModel();
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EncryptionIndicatorMode.None,
            });
        });

        it.each([
            [EventShieldReason.UNKNOWN, "Unknown error"],
            [EventShieldReason.UNVERIFIED_IDENTITY, "Encrypted by an unverified user."],
            [EventShieldReason.UNSIGNED_DEVICE, "Encrypted by a device not verified by its owner."],
            [EventShieldReason.UNKNOWN_DEVICE, "Encrypted by an unknown or deleted device."],
            [
                EventShieldReason.AUTHENTICITY_NOT_GUARANTEED,
                "The authenticity of this encrypted message can't be guaranteed on this device.",
            ],
            [EventShieldReason.MISMATCHED_SENDER_KEY, "Encrypted by an unverified session"],
            [EventShieldReason.SENT_IN_CLEAR, "Not encrypted"],
            [EventShieldReason.VERIFICATION_VIOLATION, "Sender's verified digital identity was reset"],
            [
                EventShieldReason.MISMATCHED_SENDER,
                "The sender of the event does not match the owner of the device that sent it.",
            ],
        ])(
            "shows the correct reason code for %i (%s)",
            async (reasonCode: EventShieldReason, _expectedText: string) => {
                mxEvent = await mkEncryptedMatrixEvent({
                    plainContent: { msgtype: "m.text", body: "msg1" },
                    plainType: "m.room.message",
                    sender: "@alice:example.org",
                    roomId: room.roomId,
                });
                eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                    shieldColour: EventShieldColour.GREY,
                    shieldReason: reasonCode,
                } as EventEncryptionInfo);

                const vm = createViewModel();
                await flushPromises();

                expect(vm.getSnapshot()).toMatchObject({
                    encryptionIndicatorMode: EncryptionIndicatorMode.Normal,
                    shieldReason: reasonCode,
                });
            },
        );

        it("exposes shared key metadata for forwarded messages", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            // @ts-expect-error private test setup
            mxEvent.keyForwardedBy = "@bob:example.org";
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.GREY,
                shieldReason: EventShieldReason.AUTHENTICITY_NOT_GUARANTEED,
            } as EventEncryptionInfo);

            const vm = createViewModel();
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EncryptionIndicatorMode.None,
                sharedKeysUserId: "@bob:example.org",
                sharedKeysRoomId: room.roomId,
            });
        });

        describe("undecryptable event", () => {
            filterConsole("Error decrypting event");

            it("shows an undecryptable warning", async () => {
                mxEvent = mkEvent({
                    type: "m.room.encrypted",
                    room: room.roomId,
                    user: "@alice:example.org",
                    event: true,
                    content: {},
                });

                const mockCrypto = {
                    decryptEvent: async (): Promise<IEventDecryptionResult> => {
                        throw new Error("can't decrypt");
                    },
                } as unknown as Parameters<MatrixEvent["attemptDecryption"]>[0];
                await mxEvent.attemptDecryption(mockCrypto);

                const vm = createViewModel();
                await flushPromises();

                expect(vm.getSnapshot()).toMatchObject({
                    encryptionIndicatorMode: EncryptionIndicatorMode.DecryptionFailure,
                });
            });

            it("should not show a shield for previously-verified users", async () => {
                mxEvent = mkEvent({
                    type: "m.room.encrypted",
                    room: room.roomId,
                    user: "@alice:example.org",
                    event: true,
                    content: {},
                });

                const mockCrypto = {
                    decryptEvent: async (): Promise<IEventDecryptionResult> => {
                        throw new Error("can't decrypt");
                    },
                } as unknown as Parameters<MatrixEvent["attemptDecryption"]>[0];
                await mxEvent.attemptDecryption(mockCrypto);
                // @ts-expect-error internal test setup
                mxEvent._decryptionFailureReason = DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED;

                const vm = createViewModel();
                await flushPromises();

                expect(vm.getSnapshot().encryptionIndicatorMode).toBe(EncryptionIndicatorMode.None);
            });
        });

        it("flags unencrypted replacement events when the room is encrypted", async () => {
            mxEvent = await mkEncryptedMatrixEvent({
                plainContent: { msgtype: "m.text", body: "msg1" },
                plainType: "m.room.message",
                sender: "@alice:example.org",
                roomId: room.roomId,
            });
            eventToEncryptionInfoMap.set(mxEvent.getId()!, {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
            } as EventEncryptionInfo);

            const replacementEvent = mkMessage({
                msg: "msg2",
                user: "@alice:example.org",
                room: room.roomId,
                event: true,
            });
            mxEvent.makeReplaced(replacementEvent);

            const vm = createViewModel({ isRoomEncrypted: true });
            await flushPromises();

            expect(vm.getSnapshot()).toMatchObject({
                encryptionIndicatorMode: EncryptionIndicatorMode.Warning,
            });
        });
    });

    describe("event highlighting", () => {
        beforeEach(() => {
            mocked(client.getPushActionsForEvent).mockReturnValue(null);
        });

        it("does not highlight message where message matches no push actions", () => {
            const vm = createViewModel();

            expect(client.getPushActionsForEvent).toHaveBeenCalledWith(mxEvent);
            expect(vm.getSnapshot().isHighlighted).toBeFalsy();
        });

        it("does not highlight when message's push actions does not have a highlight tweak", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: {} });

            const vm = createViewModel();

            expect(vm.getSnapshot().isHighlighted).toBeFalsy();
        });

        it("does not highlight when message's push actions have a highlight tweak but message has been redacted", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });

            const vm = createViewModel({ isRedacted: true });

            expect(vm.getSnapshot().isHighlighted).toBeFalsy();
        });

        it("highlights when message's push actions have a highlight tweak", () => {
            mocked(client.getPushActionsForEvent).mockReturnValue({
                notify: true,
                tweaks: { [TweakName.Highlight]: true },
            });

            const vm = createViewModel();

            expect(vm.getSnapshot().isHighlighted).toBeTruthy();
        });

        describe("when a message has been edited", () => {
            let editingEvent: MatrixEvent;

            beforeEach(() => {
                editingEvent = new MatrixEvent({
                    type: "m.room.message",
                    room_id: ROOM_ID,
                    sender: "@alice:example.org",
                    content: {
                        "msgtype": "m.text",
                        "body": "* edited body",
                        "m.new_content": {
                            msgtype: "m.text",
                            body: "edited body",
                        },
                        "m.relates_to": {
                            rel_type: "m.replace",
                            event_id: mxEvent.getId(),
                        },
                    },
                });
                mxEvent.makeReplaced(editingEvent);
            });

            it("does not highlight message where no version of message matches any push actions", () => {
                const vm = createViewModel();

                expect(client.getPushActionsForEvent).toHaveBeenCalledWith(mxEvent);
                expect(client.getPushActionsForEvent).toHaveBeenCalledWith(editingEvent);
                expect(vm.getSnapshot().isHighlighted).toBeFalsy();
            });

            it("does not highlight when no version of message's push actions have a highlight tweak", () => {
                mocked(client.getPushActionsForEvent).mockReturnValue({ notify: true, tweaks: {} });

                const vm = createViewModel();

                expect(vm.getSnapshot().isHighlighted).toBeFalsy();
            });

            it("highlights when previous version of message's push actions have a highlight tweak", () => {
                mocked(client.getPushActionsForEvent).mockImplementation((event: MatrixEvent) => {
                    if (event === mxEvent) {
                        return { notify: true, tweaks: { [TweakName.Highlight]: true } };
                    }
                    return { notify: false, tweaks: {} };
                });

                const vm = createViewModel();

                expect(vm.getSnapshot().isHighlighted).toBeTruthy();
            });

            it("highlights when new version of message's push actions have a highlight tweak", () => {
                mocked(client.getPushActionsForEvent).mockImplementation((event: MatrixEvent) => {
                    if (event === editingEvent) {
                        return { notify: true, tweaks: { [TweakName.Highlight]: true } };
                    }
                    return { notify: false, tweaks: {} };
                });

                const vm = createViewModel();

                expect(vm.getSnapshot().isHighlighted).toBeTruthy();
            });
        });
    });

    it.each([
        [EventStatus.NOT_SENT, false, true],
        [EventStatus.SENDING, false, true],
        [EventStatus.ENCRYPTING, false, true],
    ])("derives sending receipt flags for %s", (eventSendStatus, shouldShowSentReceipt, shouldShowSendingReceipt) => {
        const ownEvent = mkMessage({
            room: room.roomId,
            user: client.getSafeUserId(),
            msg: "Hello world!",
            event: true,
        });

        const vm = createViewModel({ mxEvent: ownEvent, eventSendStatus });

        expect(vm.getSnapshot()).toMatchObject({
            shouldShowSentReceipt,
            shouldShowSendingReceipt,
        });
    });
});
