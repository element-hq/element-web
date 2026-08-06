/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ElementCallEventType } from "../../../../call-types";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { Layout } from "../../../../settings/enums/Layout";

/**
 * Pure EventTile derivations extracted ahead of EventTileViewModel.
 * Keep this module free of React lifecycle, DOM access, dispatch, and MatrixClientPeg lookups.
 */

/** Inputs for the stable scroll token derivation. */
export interface ScrollTokenInput {
    /** The event identifier, when available. */
    eventId?: string;
    /** Whether the event is a local echo. */
    isLocalEcho: boolean;
}

/** The stable scroll token for a non-local-echo event. */
export function getScrollToken({ eventId, isLocalEcho }: ScrollTokenInput): string | undefined {
    return isLocalEcho ? undefined : eventId;
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
    const roomMessageEventType = "m.room.message";
    const stickerEventType = "m.sticker";
    const imageMsgtype = "m.image";
    const emoteMsgtype = "m.emote";

    return {
        mx_EventTile_mediaLine: isProbablyMedia,
        mx_EventTile_image: eventType === roomMessageEventType && msgtype === imageMsgtype,
        mx_EventTile_sticker: eventType === stickerEventType,
        mx_EventTile_emote: eventType === roomMessageEventType && msgtype === emoteMsgtype,
    };
}

/** Inputs for EventTile avatar and sender profile derivation. */
export interface EventTileSenderProfileStateInput {
    /** Whether the tile is rendering as a notification. */
    isRenderingNotification: boolean;
    /** Whether the event renders as an informational timeline item. */
    isInfoMessage: boolean;
    /** The current timeline rendering mode. */
    timelineRenderingType: TimelineRenderingType;
    /** Whether the tile is a continuation of the previous event. */
    continuation?: boolean;
    /** The Matrix event type for event-type sender profile derivation. */
    eventType: string;
    /** Whether the tile should use bubble container styling. */
    isBubbleMessage: boolean;
    /** The current timeline layout. */
    layout?: Layout;
    /** Whether the event is a room create event. */
    isRoomCreate: boolean;
    /** Whether the event is a call invite. */
    isCallInvite: boolean;
    /** Whether the event is an RTC notification. */
    isRtcNotification: boolean;
}

/** EventTile avatar and sender profile display state. */
export interface EventTileSenderProfileState {
    /** The avatar size to render, or null when no avatar should render. */
    avatarSize: string | null;
    /** Whether sender profile details should render. */
    needsSenderProfile: boolean;
}

/** The EventTile avatar and sender profile state for the current derived state. */
export function getEventTileSenderProfileState({
    isRenderingNotification,
    isInfoMessage,
    timelineRenderingType,
    continuation,
    eventType,
    isBubbleMessage,
    layout,
    isRoomCreate,
    isCallInvite,
    isRtcNotification,
}: EventTileSenderProfileStateInput): EventTileSenderProfileState {
    if (isRenderingNotification) {
        return { avatarSize: "24px", needsSenderProfile: true };
    }

    if (isInfoMessage) {
        return { avatarSize: "14px", needsSenderProfile: false };
    }

    if (
        timelineRenderingType === TimelineRenderingType.ThreadsList ||
        (timelineRenderingType === TimelineRenderingType.Thread && !continuation)
    ) {
        return { avatarSize: "32px", needsSenderProfile: true };
    }

    if (isRoomCreate || isBubbleMessage) {
        return { avatarSize: null, needsSenderProfile: false };
    }

    if (layout === Layout.IRC) {
        return { avatarSize: "14px", needsSenderProfile: true };
    }

    if (
        (continuation && timelineRenderingType !== TimelineRenderingType.File) ||
        isCallInvite ||
        ElementCallEventType.matches(eventType) ||
        isRtcNotification
    ) {
        return { avatarSize: null, needsSenderProfile: false };
    }

    if (timelineRenderingType === TimelineRenderingType.File) {
        return { avatarSize: "20px", needsSenderProfile: true };
    }

    return { avatarSize: "30px", needsSenderProfile: true };
}

/** Whether clicking the avatar should open the user profile. */
export function getShouldViewUserOnClick(
    inhibitInteraction: boolean | undefined,
    timelineRenderingType: TimelineRenderingType,
): boolean {
    return (
        !inhibitInteraction &&
        ![TimelineRenderingType.ThreadsList, TimelineRenderingType.Notification].includes(timelineRenderingType)
    );
}

/** SenderProfile rendering mode for EventTile. */
export type SenderProfileMode = "hidden" | "clickable" | "tooltip" | "default";

/** Inputs for EventTile sender profile mode derivation. */
export interface SenderProfileModeInput {
    /** Whether sender profile details should render. */
    needsSenderProfile: boolean;
    /** Whether sender details should be hidden. */
    hideSender?: boolean;
    /** The current timeline rendering mode. */
    timelineRenderingType: TimelineRenderingType;
}

/** The SenderProfile rendering mode for the current EventTile state. */
export function getSenderProfileMode({
    needsSenderProfile,
    hideSender,
    timelineRenderingType,
}: SenderProfileModeInput): SenderProfileMode {
    if (!needsSenderProfile || hideSender === true) {
        return "hidden";
    }

    if (
        timelineRenderingType === TimelineRenderingType.Room ||
        timelineRenderingType === TimelineRenderingType.Search ||
        timelineRenderingType === TimelineRenderingType.Pinned ||
        timelineRenderingType === TimelineRenderingType.Thread
    ) {
        return "clickable";
    }

    if (timelineRenderingType === TimelineRenderingType.ThreadsList) {
        return "tooltip";
    }

    return "default";
}

/** Inputs for EventTile message action bar visibility derivation. */
export interface ShouldShowMessageActionBarInput {
    /** Whether the event is currently being edited. */
    isEditing: boolean;
    /** Whether the tile is rendering for export. */
    forExport?: boolean;
    /** Whether the tile is currently hovered. */
    hover: boolean;
    /** Whether focus should force the action bar visible. */
    showActionBarFromFocus: boolean;
    /** Whether the action bar currently has focus. */
    actionBarFocused: boolean;
    /** Whether an EventTile context menu is currently open. */
    hasContextMenu: boolean;
}

/** Whether EventTile should render the message action bar. */
export function getShouldShowMessageActionBar({
    isEditing,
    forExport,
    hover,
    showActionBarFromFocus,
    actionBarFocused,
    hasContextMenu,
}: ShouldShowMessageActionBarInput): boolean {
    return !isEditing && !forExport && (hover || showActionBarFromFocus || (actionBarFocused && !hasContextMenu));
}

/** Inputs for EventTile timestamp visibility derivation. */
export interface ShouldShowTimestampInput {
    /** The event origin timestamp. */
    eventTs: number;
    /** Whether the event is an RTC notification. */
    isRtcNotification: boolean;
    /** Whether timestamp rendering is disabled. */
    hideTimestamp?: boolean;
    /** Whether timestamps should always show. */
    alwaysShowTimestamps?: boolean;
    /** Whether the tile is the last event in the timeline. */
    last?: boolean;
    /** Whether the tile is currently hovered. */
    hover: boolean;
    /** Whether focus is currently inside the tile. */
    focusWithin: boolean;
    /** Whether the action bar currently has focus. */
    actionBarFocused: boolean;
    /** Whether an EventTile context menu is currently open. */
    hasContextMenu: boolean;
}

/** Whether EventTile should render the message timestamp. */
export function getShouldShowTimestamp({
    eventTs,
    isRtcNotification,
    hideTimestamp,
    alwaysShowTimestamps,
    last,
    hover,
    focusWithin,
    actionBarFocused,
    hasContextMenu,
}: ShouldShowTimestampInput): boolean {
    return (
        !!eventTs &&
        !isRtcNotification &&
        !hideTimestamp &&
        (alwaysShowTimestamps || last || hover || focusWithin || actionBarFocused || hasContextMenu)
    );
}

/** Inputs for EventTile timestamp value derivation. */
export interface EventTileTimestampInput {
    /** The current timeline rendering mode. */
    timelineRenderingType: TimelineRenderingType;
    /** The event origin timestamp. */
    eventTs: number;
    /** The latest thread reply timestamp, when available. */
    threadReplyEventTs?: number;
}

/** The timestamp EventTile should display for the current rendering mode. */
export function getEventTileTimestamp({
    timelineRenderingType,
    eventTs,
    threadReplyEventTs,
}: EventTileTimestampInput): number {
    if (timelineRenderingType === TimelineRenderingType.ThreadsList && typeof threadReplyEventTs === "number") {
        return threadReplyEventTs;
    }

    return eventTs;
}

/** Inputs for EventTile timestamp display state derivation. */
export interface TimestampDisplayStateInput {
    /** The current timeline layout. */
    layout?: Layout;
    /** Whether the timestamp should render. */
    showTimestamp: boolean;
    /** The timestamp EventTile may display. */
    timestamp: number;
    /** Whether timestamp rendering is disabled. */
    hideTimestamp?: boolean;
}

/** EventTile timestamp display state. */
export interface TimestampDisplayState {
    /** Whether the current layout is IRC. */
    useIRCLayout: boolean;
    /** Whether EventTile should render the real timestamp element. */
    showRealTimestamp: boolean;
    /** Whether EventTile should render the linked timestamp element. */
    showLinkedTimestamp: boolean;
}

/** The EventTile timestamp display state for the current derived state. */
export function getTimestampDisplayState({
    layout,
    showTimestamp,
    timestamp,
    hideTimestamp,
}: TimestampDisplayStateInput): TimestampDisplayState {
    const showRealTimestamp = showTimestamp && !!timestamp;

    return {
        useIRCLayout: layout === Layout.IRC,
        showRealTimestamp,
        showLinkedTimestamp: showRealTimestamp && !hideTimestamp,
    };
}

/** Inputs for ReplyChain timestamp visibility derivation. */
export interface ReplyChainTimestampInput {
    /** Whether timestamps should always show. */
    alwaysShowTimestamps?: boolean;
    /** Whether the tile is currently hovered. */
    hover: boolean;
    /** Whether focus is currently inside the tile. */
    focusWithin: boolean;
}

/** Whether ReplyChain should always show timestamps. */
export function getReplyChainAlwaysShowTimestamps({
    alwaysShowTimestamps,
    hover,
    focusWithin,
}: ReplyChainTimestampInput): boolean {
    return !!alwaysShowTimestamps || hover || focusWithin;
}

/** Inputs for EventTile footer display state derivation. */
export interface FooterDisplayStateInput {
    /** Whether a reactions row element will render. */
    hasReactionsRow: boolean;
    /** Whether reactions data is available. */
    hasReactions: boolean;
    /** Whether a pinned message badge element will render. */
    hasPinnedMessageBadge: boolean;
    /** The current timeline layout. */
    layout?: Layout;
    /** Whether the event was sent by the current user. */
    isOwnEvent: boolean;
}

/** EventTile footer display state. */
export interface FooterDisplayState {
    /** Whether EventTile should render a footer. */
    hasFooter: boolean;
    /** Whether the main footer position should render the pinned message badge. */
    showMainPinnedMessageBadge: boolean;
    /** Whether the bubble footer position should render the pinned message badge. */
    showBubblePinnedMessageBadge: boolean;
}

/** The EventTile footer display state for the current derived state. */
export function getFooterDisplayState({
    hasReactionsRow,
    hasReactions,
    hasPinnedMessageBadge,
    layout,
    isOwnEvent,
}: FooterDisplayStateInput): FooterDisplayState {
    return {
        hasFooter: (hasReactionsRow && hasReactions) || hasPinnedMessageBadge,
        showMainPinnedMessageBadge: hasPinnedMessageBadge && (layout === Layout.Group || !isOwnEvent),
        showBubblePinnedMessageBadge: hasPinnedMessageBadge && layout === Layout.Bubble && isOwnEvent,
    };
}

/** Inputs for EventTile root CSS class derivation. */
export interface EventTileClassState {
    /** Whether the tile should use bubble container styling. */
    isBubbleMessage: boolean;
    /** Whether the bubble tile is left-aligned. */
    isLeftAlignedBubbleMessage: boolean;
    /** Whether the event is aligned between the bubbles */
    isAlignedBetweenBubbles: boolean;
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
    /** Whether the event is a call invite. */
    isCallInvite: boolean;
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
    isAlignedBetweenBubbles,
    isEditing,
    isInfoMessage,
    isTwelveHour,
    isSending,
    isHighlighted,
    isSelected,
    isContinuation,
    eventType,
    isCallInvite,
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
        mx_EventTile_alignedBetweenBubbles: isAlignedBetweenBubbles,
        mx_EventTile: true,
        mx_EventTile_isEditing: isEditing,
        mx_EventTile_info: isInfoMessage,
        mx_EventTile_12hr: isTwelveHour,
        // Note: we keep the `sending` state class for tests, not for our styles
        mx_EventTile_sending: !isEditing && isSending,
        mx_EventTile_highlight: isHighlighted,
        mx_EventTile_selected: isSelected,
        mx_EventTile_continuation: isContinuation || isCallInvite || ElementCallEventType.matches(eventType),
        mx_EventTile_last: isLast,
        mx_EventTile_lastInSection: isLastInSection,
        mx_EventTile_contextual: isContextual,
        mx_EventTile_actionBarFocused: isActionBarFocused,
        mx_EventTile_bad: isEncryptionFailure,
        mx_EventTile_emote: msgtype === "m.emote",
        mx_EventTile_noSender: hideSender,
        mx_EventTile_clamp: timelineRenderingType === TimelineRenderingType.ThreadsList || isRenderingNotification,
        mx_EventTile_noBubble: noBubbleEvent,
    };
}
