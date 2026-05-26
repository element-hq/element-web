/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventStatus, EventType, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { mkEvent } from "../../test-utils";
import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { Layout } from "../../../src/settings/enums/Layout";
import {
    EventTileViewModel,
    type EventTileViewModelProps,
} from "../../../src/viewmodels/room/timeline/event-tile/EventTileViewModel";

describe("EventTileViewModel", () => {
    const roomId = "!room:example.org";
    const userId = "@alice:example.org";
    type EventTileViewModelPropsOverrides = {
        event?: Partial<EventTileViewModelProps["event"]>;
        display?: Partial<EventTileViewModelProps["display"]>;
        interaction?: Partial<EventTileViewModelProps["interaction"]>;
        sender?: Partial<EventTileViewModelProps["sender"]>;
        timestamp?: Partial<EventTileViewModelProps["timestamp"]>;
        footer?: Partial<EventTileViewModelProps["footer"]>;
    };

    function makeMessageEvent({
        type = EventType.RoomMessage,
        content = { msgtype: MsgType.Text, body: "Hello" },
        ts = 123,
        status,
    }: {
        type?: string;
        content?: Record<string, unknown>;
        ts?: number;
        status?: EventStatus;
    } = {}): MatrixEvent {
        return mkEvent({
            event: true,
            type,
            room: roomId,
            user: userId,
            content,
            ts,
            status,
        });
    }

    function makeProps(overrides: EventTileViewModelPropsOverrides = {}): EventTileViewModelProps {
        return {
            event: {
                mxEvent: makeMessageEvent(),
                isEditing: false,
                isEncryptionFailure: false,
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

    it("derives sending, aria-live, and local echo scroll state", () => {
        const mxEvent = makeMessageEvent({ status: EventStatus.SENDING });

        const snapshot = EventTileViewModel.createSnapshot(
            makeProps({
                event: {
                    mxEvent,
                    eventSendStatus: EventStatus.SENDING,
                },
            }),
        );

        expect(snapshot.event.isSending).toBe(true);
        expect(snapshot.root.ariaLive).toBe("off");
        expect(snapshot.root.scrollToken).toBeUndefined();
        expect(snapshot.root.classState.mx_EventTile_sending).toBe(true);
    });

    it("derives render-ready root and line state", () => {
        const mxEvent = makeMessageEvent({ status: EventStatus.SENDING });

        const renderState = EventTileViewModel.createRenderState(
            makeProps({
                event: {
                    mxEvent,
                    eventSendStatus: EventStatus.SENDING,
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
        expect(renderState.timestamp).toBe(renderState.snapshot.timestamp);
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
                    mxEvent: makeMessageEvent({
                        content: { msgtype: MsgType.Image, body: "image" },
                    }),
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
                    mxEvent: makeMessageEvent({
                        type: EventType.RTCNotification,
                        content: {},
                    }),
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
});
