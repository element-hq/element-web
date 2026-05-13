/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventStatus, EventType, type MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { ElementCallEventType } from "../../../../call-types";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { Layout } from "../../../../settings/enums/Layout";

/**
 * Pure EventTile derivations extracted ahead of EventTileViewModel.
 * Keep this module free of React lifecycle, DOM access, dispatch, and MatrixClientPeg lookups.
 */

/** Whether the event send status represents a pending send state. */
export function isSendingStatus(eventSendStatus?: EventStatus): boolean {
    return [EventStatus.SENDING, EventStatus.QUEUED, EventStatus.ENCRYPTING].includes(eventSendStatus!);
}

/** The aria-live setting used by EventTile for the current send status. */
export function getAriaLive(eventSendStatus?: EventStatus | null): "off" | undefined {
    return eventSendStatus !== null ? "off" : undefined;
}

/** The stable scroll token for a non-local-echo event. */
export function getScrollToken(mxEvent: MatrixEvent): string | undefined {
    return mxEvent.status ? undefined : mxEvent.getId();
}

/** Whether EventTile should render as a continuation in the current layout/rendering mode. */
export function getIsContinuation(
    continuation: boolean | undefined,
    timelineRenderingType: TimelineRenderingType,
    layout: Layout | undefined,
): boolean | undefined {
    if (
        timelineRenderingType !== TimelineRenderingType.Room &&
        timelineRenderingType !== TimelineRenderingType.Search &&
        timelineRenderingType !== TimelineRenderingType.Thread &&
        layout !== Layout.Bubble
    ) {
        return false;
    }

    return continuation;
}

/** Inputs for EventTile line CSS class derivation. */
export interface EventTileLineClassState {
    /** Whether the event body is likely to render media content. */
    isProbablyMedia: boolean;
    /** The Matrix event type for event-type class derivation. */
    eventType: string;
    /** The Matrix message type for message-type class derivation. */
    msgtype?: string;
}

/** The EventTile line CSS class flags for the current derived state. */
export function getEventTileLineClassState({
    isProbablyMedia,
    eventType,
    msgtype,
}: EventTileLineClassState): Record<string, boolean> {
    return {
        mx_EventTile_mediaLine: isProbablyMedia,
        mx_EventTile_image: eventType === EventType.RoomMessage && msgtype === MsgType.Image,
        mx_EventTile_sticker: eventType === EventType.Sticker,
        mx_EventTile_emote: eventType === EventType.RoomMessage && msgtype === MsgType.Emote,
    };
}

/** Inputs for EventTile root CSS class derivation. */
export interface EventTileClassState {
    /** Whether the tile should use bubble container styling. */
    isBubbleMessage: boolean;
    /** Whether the bubble tile is left-aligned. */
    isLeftAlignedBubbleMessage: boolean;
    /** Whether the event is currently being edited. */
    isEditing: boolean;
    /** Whether the event renders as an informational timeline item. */
    isInfoMessage: boolean;
    /** Whether timestamps use twelve-hour formatting. */
    isTwelveHour?: boolean;
    /** Whether the event is in a pending send state. */
    isSending: boolean;
    /** Whether the event should be highlighted. */
    isHighlighted: boolean;
    /** Whether the tile is selected or has an open context menu. */
    isSelected: boolean;
    /** Whether the tile is a continuation of the previous event. */
    isContinuation?: boolean;
    /** The Matrix event type for event-type class derivation. */
    eventType: string;
    /** Whether the tile is the last event in the timeline. */
    isLast?: boolean;
    /** Whether the tile is the last event in its section. */
    isLastInSection?: boolean;
    /** Whether the tile is being rendered in contextual mode. */
    isContextual?: boolean;
    /** Whether the action bar currently has focus. */
    isActionBarFocused: boolean;
    /** Whether the event failed decryption. */
    isEncryptionFailure: boolean;
    /** The Matrix message type for message-type class derivation. */
    msgtype?: string;
    /** Whether sender details should be hidden. */
    hideSender?: boolean;
    /** The current timeline rendering mode. */
    timelineRenderingType: TimelineRenderingType;
    /** Whether the tile is rendering as a notification. */
    isRenderingNotification: boolean;
    /** Whether bubble styling should be suppressed for this event. */
    noBubbleEvent: boolean;
}

/** The EventTile root CSS class flags for the current derived state. */
export function getEventTileClassState({
    isBubbleMessage,
    isLeftAlignedBubbleMessage,
    isEditing,
    isInfoMessage,
    isTwelveHour,
    isSending,
    isHighlighted,
    isSelected,
    isContinuation,
    eventType,
    isLast,
    isLastInSection,
    isContextual,
    isActionBarFocused,
    isEncryptionFailure,
    msgtype,
    hideSender,
    timelineRenderingType,
    isRenderingNotification,
    noBubbleEvent,
}: EventTileClassState): Record<string, boolean | undefined> {
    return {
        mx_EventTile_bubbleContainer: isBubbleMessage,
        mx_EventTile_leftAlignedBubble: isLeftAlignedBubbleMessage,
        mx_EventTile: true,
        mx_EventTile_isEditing: isEditing,
        mx_EventTile_info: isInfoMessage,
        mx_EventTile_12hr: isTwelveHour,
        // Note: we keep the `sending` state class for tests, not for our styles
        mx_EventTile_sending: !isEditing && isSending,
        mx_EventTile_highlight: isHighlighted,
        mx_EventTile_selected: isSelected,
        mx_EventTile_continuation:
            isContinuation || eventType === EventType.CallInvite || ElementCallEventType.matches(eventType),
        mx_EventTile_last: isLast,
        mx_EventTile_lastInSection: isLastInSection,
        mx_EventTile_contextual: isContextual,
        mx_EventTile_actionBarFocused: isActionBarFocused,
        mx_EventTile_bad: isEncryptionFailure,
        mx_EventTile_emote: msgtype === MsgType.Emote,
        mx_EventTile_noSender: hideSender,
        mx_EventTile_clamp: timelineRenderingType === TimelineRenderingType.ThreadsList || isRenderingNotification,
        mx_EventTile_noBubble: noBubbleEvent,
    };
}
