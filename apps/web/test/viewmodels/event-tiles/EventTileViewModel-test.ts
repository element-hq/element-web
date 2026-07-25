/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { Layout } from "../../../src/settings/enums/Layout";
import {
    EventTileViewModel,
    type EventTileViewModelProps,
} from "../../../src/viewmodels/room/timeline/event-tile/EventTileViewModel";

describe("EventTileViewModel", () => {
    type EventTileViewModelPropsOverrides = {
        event?: Partial<EventTileViewModelProps["event"]>;
        display?: Partial<EventTileViewModelProps["display"]>;
        interaction?: Partial<EventTileViewModelProps["interaction"]>;
        sender?: Partial<EventTileViewModelProps["sender"]>;
        timestamp?: Partial<EventTileViewModelProps["timestamp"]>;
        footer?: Partial<EventTileViewModelProps["footer"]>;
    };

    function makeProps(overrides: EventTileViewModelPropsOverrides = {}): EventTileViewModelProps {
        return {
            event: {
                eventType: "m.room.message",
                msgtype: "m.text",
                eventTs: 123,
                eventId: "$event",
                isLocalEcho: false,
                isSending: false,
                ariaLive: "off",
                isRoomCreate: false,
                isCallInvite: false,
                isRtcNotification: false,
                isEditing: false,
                isEncryptionFailure: false,
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
        expect(snapshot.root.ariaLive).toBe("off");
        expect(snapshot.root.scrollToken).toBeUndefined();
        expect(snapshot.root.classState.mx_EventTile_sending).toBe(true);
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
        expect(renderState.root.className).toContain("mx_EventTile");
        expect(renderState.root.className).toContain("mx_EventTile_sending");
        expect(renderState.root.className).toContain("mx_EventTile_highlight");
        expect(renderState.root.ariaLive).toBe("off");
        expect(renderState.root.scrollToken).toBeUndefined();
        expect(renderState.root.isRenderingNotification).toBe(false);
        expect(renderState.line.className).toContain("mx_EventTile_line");
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

    it("derives timestamp slots for group layout", () => {
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

        expect(renderState.timestamp.showDummy).toBe(false);
        expect(renderState.timestamp.showInGroupLine).toBe(true);
        expect(renderState.timestamp.showInIrcLine).toBe(false);
    });

    it("derives timestamp slots for IRC layout", () => {
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

        expect(renderState.timestamp.showDummy).toBe(true);
        expect(renderState.timestamp.showInGroupLine).toBe(false);
        expect(renderState.timestamp.showInIrcLine).toBe(true);
    });

    it("keeps the IRC timestamp slot for the dummy timestamp when timestamps are hidden", () => {
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

        expect(renderState.timestamp.showDummy).toBe(true);
        expect(renderState.timestamp.displayState.showLinkedTimestamp).toBe(false);
        expect(renderState.timestamp.showInGroupLine).toBe(false);
        expect(renderState.timestamp.showInIrcLine).toBe(true);
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

        expect(snapshot.line.classState).toMatchObject({
            mx_EventTile_mediaLine: true,
            mx_EventTile_image: true,
            mx_EventTile_sticker: false,
            mx_EventTile_emote: false,
        });
    });

    it("derives aligned-between-bubbles root class state", () => {
        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                display: {
                    isAlignedBetweenBubbles: true,
                },
            }),
        );

        expect(snapshot.root.classState.mx_EventTile_alignedBetweenBubbles).toBe(true);
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
        const vm = new EventTileViewModel(makeProps());
        const listener = jest.fn();
        const unsubscribe = vm.subscribe(listener);

        expect(vm.getSnapshot().snapshot.timestamp.show).toBe(false);

        vm.setProps(makeProps({ interaction: { hover: true } }));

        expect(vm.getSnapshot().snapshot.timestamp.show).toBe(true);
        expect(listener).toHaveBeenCalled();

        unsubscribe();
        vm.dispose();
    });

    it("lazily owns timestamp child view models", () => {
        const vm = new EventTileViewModel(makeProps());
        const messageTimestampViewModel = vm.getMessageTimestampViewModel({ ts: 123 });
        const linkedMessageTimestampViewModel = vm.getLinkedMessageTimestampViewModel({ ts: 456 });

        expect(messageTimestampViewModel.getSnapshot().href).toBeUndefined();
        expect(linkedMessageTimestampViewModel.getSnapshot().href).toBeUndefined();

        vm.dispose();
    });

    it("does not initialize timestamp child view models for events without an origin timestamp", () => {
        const vm = new EventTileViewModel(
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
        const vm = new EventTileViewModel(makeProps());
        const onViewInRoomClick = jest.fn();
        const onCopyLinkClick = jest.fn();

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
