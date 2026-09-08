/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { vi, describe, it, expect } from "vitest";
import { mkEvent, stubClient } from "test-utils";

import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { Layout } from "../../../../settings/enums/Layout";
import {
    EventTileViewModel,
    type EventTileViewModelDependencies,
    type NormalizedEventTileViewModelProps,
    type EventTileViewModelProps,
} from "./EventTileViewModel";

describe("EventTileViewModel", () => {
    const matrixClient = stubClient();

    const makeEvent = () =>
        mkEvent({
            event: true,
            id: "$event",
            room: "!room:example.org",
            ts: 123,
            type: "m.room.message",
            user: "@alice:example.org",
            content: { msgtype: "m.text" },
        });

    const makeDependencies = (mxEvent = makeEvent()): EventTileViewModelDependencies => ({
        mxEvent,
        matrixClient,
        showHiddenEvents: false,
    });

    type EventTileViewModelPropsOverrides = {
        shape?: EventTileViewModelProps["shape"];
        event?: Partial<NormalizedEventTileViewModelProps["event"]>;
        display?: Partial<EventTileViewModelProps["display"]>;
        interaction?: Partial<EventTileViewModelProps["interaction"]>;
        sender?: Partial<EventTileViewModelProps["sender"]>;
        timestamp?: Partial<EventTileViewModelProps["timestamp"]>;
        footer?: Partial<EventTileViewModelProps["footer"]>;
    };

    function makeProps(overrides: EventTileViewModelPropsOverrides = {}): NormalizedEventTileViewModelProps {
        return {
            shape: overrides.shape,
            event: {
                eventType: "m.room.message",
                msgtype: "m.text",
                eventTs: 123,
                eventId: "$event",
                isState: false,
                hasReplyChain: false,
                isLocalEcho: false,
                isSending: false,
                ariaLive: "off",
                isRoomCreate: false,
                isCallInvite: false,
                isRtcNotification: false,
                isEditing: false,
                isEncryptionFailure: false,
                hasRenderer: true,
                isSeeingThroughMessageHiddenForModeration: false,
                forExport: false,
                ...overrides.event,
            },
            display: {
                timelineRenderingType: TimelineRenderingType.Room,
                layout: Layout.Group,
                isProbablyMedia: false,
                isBubbleMessage: false,
                isLeftAlignedBubbleMessage: false,
                isAlignedBetweenBubbles: false,
                isInfoMessage: false,
                noBubbleEvent: false,
                isHighlighted: false,
                isSelected: false,
                ...overrides.display,
            },
            interaction: {
                hover: false,
                showActionBarFromFocus: false,
                focusWithin: false,
                isActionBarFocused: false,
                hasContextMenu: false,
                ...overrides.interaction,
            },
            sender: {
                senderId: "@alice:example.org",
                member: null,
                isEmote: false,
                ...overrides.sender,
            },
            timestamp: {
                ...overrides.timestamp,
            },
            footer: {
                isOwnEvent: false,
                hasReactionsRow: false,
                hasReactions: false,
                hasPinnedMessageBadge: false,
                ...overrides.footer,
            },
        };
    }

    it("derives sending, aria-live, and scroll state from plain event data", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                event: {
                    isSending: true,
                    isLocalEcho: true,
                },
            }),
        );

        expect(snapshot.event.isSending).toBe(true);
        expect(snapshot.event).toMatchObject({
            eventId: "$event",
            eventTs: 123,
            isLocalEcho: true,
            isEncryptionFailure: false,
        });
        expect(snapshot.root.ariaLive).toBe("off");
        expect(snapshot.root.scrollToken).toBeUndefined();
        expect(snapshot.root).toMatchObject({
            eventId: "$event",
            shape: "Room",
            state: {
                isOwnEvent: false,
                hasReply: false,
            },
        });
    });

    it("derives a scroll token for non-local-echo events", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                event: {
                    eventId: "$remote-event",
                    isLocalEcho: false,
                },
            }),
        );

        expect(snapshot.root.scrollToken).toBe("$remote-event");
    });

    it("uses a host-provided EventTileView shape", () => {
        const snapshot = EventTileViewModel.createSnapshot(makeProps({ shape: "Card" }));

        expect(snapshot.root.shape).toBe("Card");
    });

    it("derives render-ready root and line state", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                event: {
                    isSending: true,
                    isLocalEcho: true,
                },
                display: {
                    isHighlighted: true,
                },
            }),
        );

        expect(renderState.snapshot.event.isSending).toBe(true);
        expect(renderState.root.ariaLive).toBe("off");
        expect(renderState.root.scrollToken).toBeUndefined();
        expect(renderState.root.eventId).toBe("$event");
        expect(renderState.root.shape).toBe("Room");
        expect(renderState.root.state).toMatchObject({
            isOwnEvent: false,
            hasReply: false,
            highlighted: true,
            selected: false,
            editing: false,
            continuation: false,
        });
        expect(renderState.classNames).toMatchObject({
            root: "mx_EventTile",
            line: "mx_EventTile_line",
        });
        expect(renderState.line).toEqual({
            media: false,
            sticker: false,
            emote: false,
            image: false,
        });
        expect(renderState.timestamp).toMatchObject(renderState.snapshot.timestamp);
    });

    it("derives E2E padlock placement for group layout", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                display: {
                    layout: Layout.Group,
                    isBubbleMessage: false,
                },
            }),
        );

        expect(renderState.e2ePadlock).toEqual({
            showInGroupLine: true,
            showInIrcLine: false,
        });
    });

    it("derives E2E padlock placement for IRC layout", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                display: {
                    layout: Layout.IRC,
                    isBubbleMessage: false,
                },
            }),
        );

        expect(renderState.e2ePadlock).toEqual({
            showInGroupLine: false,
            showInIrcLine: true,
        });
    });

    it("does not place E2E padlocks for bubble messages", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                display: {
                    layout: Layout.Group,
                    isBubbleMessage: true,
                },
            }),
        );

        expect(renderState.e2ePadlock).toEqual({
            showInGroupLine: false,
            showInIrcLine: false,
        });
    });

    it("keeps timestamp display state for group layout", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                display: {
                    layout: Layout.Group,
                },
                interaction: {
                    hover: true,
                },
            }),
        );

        expect(renderState.timestamp.displayState.showRealTimestamp).toBe(true);
    });

    it("keeps timestamp display state for IRC layout", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                display: {
                    layout: Layout.IRC,
                },
                interaction: {
                    hover: true,
                },
            }),
        );

        expect(renderState.timestamp.displayState.showLinkedTimestamp).toBe(true);
    });

    it("does not create a timestamp slot when IRC timestamps are hidden", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                display: {
                    layout: Layout.IRC,
                },
                interaction: {
                    hover: true,
                },
                timestamp: {
                    hideTimestamp: true,
                },
            }),
        );

        expect(renderState.timestamp.displayState.showLinkedTimestamp).toBe(false);
    });

    it("normalizes continuation by rendering mode and bubble layout", () => {
        const fileSnapshot = EventTileViewModel.createSnapshot(
            makeProps({
                display: {
                    continuation: true,
                    timelineRenderingType: TimelineRenderingType.File,
                    layout: Layout.Group,
                },
            }),
        );
        const bubbleSnapshot = EventTileViewModel.createSnapshot(
            makeProps({
                display: {
                    continuation: true,
                    timelineRenderingType: TimelineRenderingType.File,
                    layout: Layout.Bubble,
                },
            }),
        );

        expect(fileSnapshot.event.isContinuation).toBe(false);
        expect(bubbleSnapshot.event.isContinuation).toBe(true);
    });

    it("derives line classes from event type, message type, and media eligibility", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                event: {
                    msgtype: "m.image",
                },
                display: {
                    isProbablyMedia: true,
                },
            }),
        );

        expect(snapshot.line).toEqual({
            media: true,
            sticker: false,
            emote: false,
            image: true,
        });
    });

    it("derives shared EventTileView root states from application inputs", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                event: {
                    eventType: "m.sticker",
                    msgtype: "m.emote",
                    isEncryptionFailure: true,
                    isEditing: true,
                },
                display: {
                    timelineRenderingType: TimelineRenderingType.ThreadsList,
                    continuation: true,
                    isBubbleMessage: true,
                    isLeftAlignedBubbleMessage: true,
                    isAlignedBetweenBubbles: true,
                    isInfoMessage: true,
                    noBubbleEvent: true,
                    isHighlighted: true,
                    isSelected: true,
                    isLastInSection: true,
                    isContextual: true,
                },
                interaction: {
                    isActionBarFocused: true,
                },
                sender: {
                    hideSender: true,
                    isEmote: true,
                },
                footer: {
                    isOwnEvent: true,
                },
            }),
        );

        expect(snapshot.root.state).toEqual({
            isOwnEvent: true,
            hasReply: false,
            info: true,
            bubbleContainer: true,
            leftAlignedBubble: true,
            alignedBetweenBubbles: true,
            noBubble: true,
            noSender: true,
            encryptionFailure: true,
            emote: true,
            highlighted: true,
            selected: true,
            editing: true,
            continuation: false,
            lastInSection: true,
            contextual: true,
            actionBarFocused: true,
            previewClamped: true,
        });
        expect(snapshot.line).toEqual({
            media: false,
            sticker: true,
            emote: true,
            image: false,
        });
    });

    it("derives aligned-between-bubbles root state", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                display: {
                    isAlignedBetweenBubbles: true,
                },
            }),
        );

        expect(snapshot.root.state.alignedBetweenBubbles).toBe(true);
    });

    it("derives avatar and sender profile state for thread timelines", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                display: {
                    timelineRenderingType: TimelineRenderingType.Thread,
                    continuation: false,
                },
            }),
        );

        expect(snapshot.sender.profileState).toEqual({
            avatarSize: "32px",
            needsSenderProfile: true,
        });
        expect(snapshot.sender.profileMode).toBe("clickable");
        expect(snapshot.sender.viewUserOnClick).toBe(true);
    });

    it("carries pure sender render inputs", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                sender: {
                    senderId: "@moderator:example.org",
                    isEmote: true,
                },
            }),
        );

        expect(snapshot.sender.senderId).toBe("@moderator:example.org");
        expect(snapshot.sender.isEmote).toBe(true);
    });

    it("marks room member avatars as historical", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                event: {
                    eventType: "m.room.member",
                },
            }),
        );

        expect(snapshot.sender.forceHistoricalAvatar).toBe(true);
    });

    it("derives action bar visibility from interaction state", () => {
        const hoverSnapshot = EventTileViewModel.createSnapshot(makeProps({ interaction: { hover: true } }));
        const contextMenuSnapshot = EventTileViewModel.createSnapshot(
            makeProps({
                interaction: {
                    isActionBarFocused: true,
                    hasContextMenu: true,
                },
            }),
        );

        expect(hoverSnapshot.actionBar.show).toBe(true);
        expect(contextMenuSnapshot.actionBar.show).toBe(false);
    });

    it("derives timestamp state for thread list events", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                display: {
                    timelineRenderingType: TimelineRenderingType.ThreadsList,
                },
                interaction: {
                    hover: true,
                },
                timestamp: {
                    threadReplyEventTs: 456,
                },
            }),
        );

        expect(snapshot.timestamp.show).toBe(true);
        expect(snapshot.timestamp.value).toBe(456);
        expect(snapshot.timestamp.displayState.showRealTimestamp).toBe(true);
    });

    it("suppresses RTC notification timestamps", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                event: {
                    isRtcNotification: true,
                },
                interaction: {
                    hover: true,
                },
            }),
        );

        expect(snapshot.timestamp.show).toBe(false);
        expect(snapshot.timestamp.displayState.showRealTimestamp).toBe(false);
    });

    it("derives footer placement state", () => {
        const groupSnapshot = EventTileViewModel.createSnapshot(
            makeProps({
                display: {
                    layout: Layout.Group,
                },
                footer: {
                    isOwnEvent: true,
                    hasReactionsRow: true,
                    hasReactions: true,
                    hasPinnedMessageBadge: true,
                },
            }),
        );
        const bubbleSnapshot = EventTileViewModel.createSnapshot(
            makeProps({
                display: {
                    layout: Layout.Bubble,
                },
                footer: {
                    isOwnEvent: true,
                    hasPinnedMessageBadge: true,
                },
            }),
        );

        expect(groupSnapshot.footer).toMatchObject({
            hasFooter: true,
            showMainPinnedMessageBadge: true,
            showBubblePinnedMessageBadge: false,
        });
        expect(bubbleSnapshot.footer).toMatchObject({
            hasFooter: true,
            showMainPinnedMessageBadge: false,
            showBubblePinnedMessageBadge: true,
        });
    });

    it("derives footer render placement for default layouts", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                display: {
                    layout: Layout.Group,
                },
                footer: {
                    isOwnEvent: true,
                    hasReactionsRow: true,
                    hasReactions: true,
                },
            }),
        );

        expect(renderState.footer).toMatchObject({
            hasFooter: true,
            showInIrcLayout: false,
            showInDefaultLayout: true,
        });
    });

    it("derives footer render placement for IRC layout", () => {
        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                display: {
                    layout: Layout.IRC,
                },
                footer: {
                    isOwnEvent: true,
                    hasReactionsRow: true,
                    hasReactions: true,
                },
            }),
        );

        expect(renderState.footer).toMatchObject({
            hasFooter: true,
            showInIrcLayout: true,
            showInDefaultLayout: false,
        });
    });

    it("updates an instance snapshot when inputs change", () => {
        const vm = new EventTileViewModel(makeDependencies(), makeProps());
        const listener = vi.fn();
        const unsubscribe = vm.subscribe(listener);

        expect(vm.getSnapshot().snapshot.timestamp.show).toBe(false);

        vm.setInputs(makeDependencies(), makeProps({ interaction: { hover: true } }));

        expect(vm.getSnapshot().snapshot.timestamp.show).toBe(true);
        expect(listener).toHaveBeenCalled();

        unsubscribe();
        vm.dispose();
    });

    it("emits once when dependencies and inputs are updated together", () => {
        const vm = new EventTileViewModel(makeDependencies(), makeProps());
        const listener = vi.fn();
        const unsubscribe = vm.subscribe(listener);

        vm.setInputs(makeDependencies(), makeProps({ interaction: { hover: true } }));

        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        vm.dispose();
    });

    it("normalizes event and sender state from its SDK dependency", () => {
        const event = mkEvent({
            event: true,
            id: "$member-event",
            room: "!room:example.org",
            ts: 456,
            type: "m.room.member",
            user: "@bob:example.org",
            content: { membership: "join" },
        });
        const vm = new EventTileViewModel(
            makeDependencies(event),
            makeProps({
                event: {
                    eventType: "m.room.message",
                    eventId: "$wrong-event",
                    eventTs: 123,
                },
                sender: {
                    senderId: "@wrong:example.org",
                    isEmote: false,
                },
            }),
        );

        expect(vm.getSnapshot().snapshot.event).toMatchObject({
            eventType: "m.room.member",
            eventId: "$member-event",
            eventTs: 456,
            isState: true,
        });
        expect(vm.getSnapshot().snapshot.sender).toMatchObject({
            senderId: "@bob:example.org",
            forceHistoricalAvatar: true,
            isEmote: false,
        });

        vm.setInputs(
            makeDependencies(
                mkEvent({
                    event: true,
                    id: "$updated-event",
                    room: "!room:example.org",
                    ts: 789,
                    type: "m.call.invite",
                    user: "@carol:example.org",
                    content: { msgtype: "m.call.invite" },
                }),
            ),
            makeProps(),
        );

        expect(vm.getSnapshot().snapshot.event).toMatchObject({
            eventType: "m.call.invite",
            eventId: "$updated-event",
            eventTs: 789,
        });
        expect(vm.getSnapshot().snapshot.sender.senderId).toBe("@carol:example.org");

        vm.dispose();
    });

    it("normalizes event identity, replacement, renderer, and decryption state", () => {
        const event = makeEvent();
        vi.spyOn(event, "replacingEventId").mockReturnValue("$replaced-event");
        vi.spyOn(event, "isDecryptionFailure").mockReturnValue(true);

        const vm = new EventTileViewModel(makeDependencies(event), makeProps());
        const snapshot = vm.getSnapshot().snapshot;

        expect(snapshot.event).toMatchObject({
            eventType: "m.room.message",
            eventId: "$event",
            replacingEventId: "$replaced-event",
            isEncryptionFailure: true,
            hasRenderer: true,
        });

        vm.dispose();
    });

    it("does not show a reply chain for replacement events", () => {
        const event = mkEvent({
            event: true,
            id: "$replacement-event",
            room: "!room:example.org",
            ts: 123,
            type: "m.room.message",
            user: "@alice:example.org",
            content: {
                "msgtype": "m.text",
                "m.relates_to": {
                    "rel_type": "m.replace",
                    "event_id": "$original-event",
                    "m.in_reply_to": {
                        event_id: "$parent-event",
                    },
                },
            },
        });
        const vm = new EventTileViewModel(makeDependencies(event), makeProps());

        expect(vm.getSnapshot().snapshot.root.state.hasReply).toBe(false);

        vm.dispose();
    });

    it("derives an unavailable renderer for unsupported events", () => {
        const event = mkEvent({
            event: true,
            room: "!room:example.org",
            type: "org.example.unsupported",
            user: "@alice:example.org",
            content: {},
        });
        const vm = new EventTileViewModel(makeDependencies(event), makeProps());

        expect(vm.getSnapshot().snapshot.event.hasRenderer).toBe(false);

        vm.dispose();
    });

    it("recalculates renderer state when dependencies change", () => {
        const event = mkEvent({
            event: true,
            room: "!room:example.org",
            type: "org.example.unsupported",
            user: "@alice:example.org",
            content: {},
        });
        const vm = new EventTileViewModel(makeDependencies(event), makeProps());

        expect(vm.getSnapshot().snapshot.event.hasRenderer).toBe(false);

        vm.setInputs(makeDependencies(makeEvent()), makeProps());

        expect(vm.getSnapshot().snapshot.event.hasRenderer).toBe(true);

        vm.dispose();
    });

    it("lazily owns timestamp child view models", () => {
        const vm = new EventTileViewModel(makeDependencies(), makeProps());
        const messageTimestampViewModel = vm.getMessageTimestampViewModel({ ts: 123 });
        const linkedMessageTimestampViewModel = vm.getLinkedMessageTimestampViewModel({ ts: 456 });

        expect(messageTimestampViewModel.getSnapshot().href).toBeUndefined();
        expect(linkedMessageTimestampViewModel.getSnapshot().href).toBeUndefined();

        vm.dispose();
    });

    it("does not initialize timestamp child view models for events without an origin timestamp", () => {
        const vm = new EventTileViewModel(
            makeDependencies(),
            makeProps({
                event: {
                    eventTs: 0,
                },
                timestamp: {
                    hideTimestamp: true,
                },
            }),
        );

        expect(vm.getSnapshot().timestamp.displayState.showRealTimestamp).toBe(false);

        vm.dispose();
    });

    it("owns and updates the thread-list action bar child view model", () => {
        const vm = new EventTileViewModel(makeDependencies(), makeProps());
        const onViewInRoomClick = vi.fn();
        const onCopyLinkClick = vi.fn();

        const threadListActionBarViewModel = vm.getThreadListActionBarViewModel({
            onViewInRoomClick,
            onCopyLinkClick,
        });

        threadListActionBarViewModel.onViewInRoomClick(null);
        threadListActionBarViewModel.onCopyLinkClick(null);

        expect(onViewInRoomClick).toHaveBeenCalledWith(null);
        expect(onCopyLinkClick).toHaveBeenCalledWith(null);

        vm.dispose();
    });
});
