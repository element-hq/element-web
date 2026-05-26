/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EventStatus, type MatrixEvent, type RoomMember } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import {
    type EventTileSenderProfileState,
    type FooterDisplayState,
    getAriaLive,
    getEventTileAvatarMember,
    getEventTileClassState,
    getEventTileLineClassState,
    getEventTileSenderProfileState,
    getEventTileTimestamp,
    getFooterDisplayState,
    getIsContinuation,
    getReplyChainAlwaysShowTimestamps,
    getScrollToken,
    getSenderProfileMode,
    getShouldShowMessageActionBar,
    getShouldShowTimestamp,
    getShouldViewUserOnClick,
    getTimestampDisplayState,
    isSendingStatus,
    type SenderProfileMode,
    type TimestampDisplayState,
} from "./EventTileDerivedState";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { type Layout } from "../../../../settings/enums/Layout";

/** Event-level inputs for deriving the EventTile snapshot. */
export interface EventTileEventInput {
    /** The Matrix event rendered by the tile. */
    mxEvent: MatrixEvent;
    /** The event send status supplied by EventTile. */
    eventSendStatus?: EventStatus | null;
    /** Whether the event is currently being edited. */
    isEditing: boolean;
    /** Whether the event failed decryption. */
    isEncryptionFailure: boolean;
    /** Whether the tile is rendering for export. */
    forExport?: boolean;
}

/** Display inputs for deriving the EventTile snapshot. */
export interface EventTileDisplayInput {
    /** The current timeline rendering mode. */
    timelineRenderingType: TimelineRenderingType;
    /** The current timeline layout. */
    layout?: Layout;
    /** Whether the tile is a continuation of the previous event. */
    continuation?: boolean;
    /** Whether the event body is likely to render media content. */
    isProbablyMedia: boolean;
    /** Whether the tile should use bubble container styling. */
    isBubbleMessage: boolean;
    /** Whether the bubble tile is left-aligned. */
    isLeftAlignedBubbleMessage: boolean;
    /** Whether the event is aligned between bubble columns. */
    isAlignedBetweenBubbles: boolean;
    /** Whether the event renders as an informational timeline item. */
    isInfoMessage: boolean;
    /** Whether bubble styling should be suppressed for this event. */
    noBubbleEvent: boolean;
    /** Whether timestamps use twelve-hour formatting. */
    isTwelveHour?: boolean;
    /** Whether the event should be highlighted. */
    isHighlighted: boolean;
    /** Whether the tile is selected or has an open context menu. */
    isSelected: boolean;
    /** Whether the tile is the last event in the timeline. */
    isLast?: boolean;
    /** Whether the tile is the last event in its section. */
    isLastInSection?: boolean;
    /** Whether the tile is being rendered in contextual mode. */
    isContextual?: boolean;
}

/** Interaction inputs for deriving the EventTile snapshot. */
export interface EventTileInteractionInput {
    /** Whether the tile is currently hovered. */
    hover: boolean;
    /** Whether focus should force the action bar visible. */
    showActionBarFromFocus: boolean;
    /** Whether focus is currently inside the tile. */
    focusWithin: boolean;
    /** Whether the action bar currently has focus. */
    isActionBarFocused: boolean;
    /** Whether an EventTile context menu is currently open. */
    hasContextMenu: boolean;
    /** Whether interaction should be inhibited inside the tile. */
    inhibitInteraction?: boolean;
}

/** Sender inputs for deriving the EventTile snapshot. */
export interface EventTileSenderInput {
    /** Whether sender details should be hidden. */
    hideSender?: boolean;
}

/** Timestamp inputs for deriving the EventTile snapshot. */
export interface EventTileTimestampInput {
    /** Whether timestamps should always show. */
    alwaysShowTimestamps?: boolean;
    /** Whether timestamp rendering is disabled. */
    hideTimestamp?: boolean;
    /** The latest thread reply timestamp, when available. */
    threadReplyEventTs?: number;
}

/** Footer inputs for deriving the EventTile snapshot. */
export interface EventTileFooterInput {
    /** Whether the event was sent by the current user. */
    isOwnEvent: boolean;
    /** Whether a reactions row element will render. */
    hasReactionsRow: boolean;
    /** Whether reactions data is available. */
    hasReactions: boolean;
    /** Whether a pinned message badge element will render. */
    hasPinnedMessageBadge: boolean;
}

/** Inputs for deriving the EventTile view model snapshot. */
export interface EventTileViewModelProps {
    /** Event-level inputs. */
    event: EventTileEventInput;
    /** Display inputs. */
    display: EventTileDisplayInput;
    /** Interaction inputs. */
    interaction: EventTileInteractionInput;
    /** Sender inputs. */
    sender: EventTileSenderInput;
    /** Timestamp inputs. */
    timestamp: EventTileTimestampInput;
    /** Footer inputs. */
    footer: EventTileFooterInput;
}

/** Event-level state derived for the EventTile snapshot. */
export interface EventTileEventSnapshot {
    /** The Matrix event type. */
    eventType: string;
    /** The Matrix message type. */
    msgtype?: string;
    /** Whether the event is in a pending send state. */
    isSending: boolean;
    /** Whether the event is currently being edited. */
    isEditing: boolean;
    /** Whether EventTile should render as a continuation. */
    isContinuation?: boolean;
    /** Whether the tile is rendering as a notification. */
    isRenderingNotification: boolean;
}

/** Root state derived for the EventTile snapshot. */
export interface EventTileRootSnapshot {
    /** The aria-live setting used by EventTile. */
    ariaLive?: "off";
    /** The stable scroll token for the event. */
    scrollToken?: string;
    /** EventTile root CSS class flags. */
    classState: ReturnType<typeof getEventTileClassState>;
}

/** Line state derived for the EventTile snapshot. */
export interface EventTileLineSnapshot {
    /** EventTile line CSS class flags. */
    classState: ReturnType<typeof getEventTileLineClassState>;
}

/** Sender state derived for the EventTile snapshot. */
export interface EventTileSenderSnapshot {
    /** EventTile avatar and sender profile display state. */
    profileState: EventTileSenderProfileState;
    /** The room member whose avatar should render. */
    avatarMember: RoomMember | null;
    /** Whether clicking the avatar should open the user profile. */
    viewUserOnClick: boolean;
    /** SenderProfile rendering mode. */
    profileMode: SenderProfileMode;
}

/** Action bar state derived for the EventTile snapshot. */
export interface EventTileActionBarSnapshot {
    /** Whether EventTile should render the message action bar. */
    show: boolean;
}

/** Timestamp state derived for the EventTile snapshot. */
export interface EventTileTimestampSnapshot {
    /** Whether EventTile should render the message timestamp. */
    show: boolean;
    /** The timestamp EventTile should display. */
    value: number;
    /** EventTile timestamp display state. */
    displayState: TimestampDisplayState;
}

/** Reply chain state derived for the EventTile snapshot. */
export interface EventTileReplyChainSnapshot {
    /** Whether ReplyChain should always show timestamps. */
    alwaysShowTimestamps: boolean;
}

/** Footer state derived for the EventTile snapshot. */
export type EventTileFooterSnapshot = FooterDisplayState;

/** Derived EventTile view state consumed by the existing component. */
export interface EventTileViewModelSnapshot {
    /** Event-level derived state. */
    event: EventTileEventSnapshot;
    /** Root derived state. */
    root: EventTileRootSnapshot;
    /** Line derived state. */
    line: EventTileLineSnapshot;
    /** Sender derived state. */
    sender: EventTileSenderSnapshot;
    /** Action bar derived state. */
    actionBar: EventTileActionBarSnapshot;
    /** Timestamp derived state. */
    timestamp: EventTileTimestampSnapshot;
    /** Reply chain derived state. */
    replyChain: EventTileReplyChainSnapshot;
    /** Footer derived state. */
    footer: EventTileFooterSnapshot;
}

/** Render-ready EventTile state consumed by the existing component. */
export interface EventTileRenderState {
    /** Derived EventTile view state. */
    snapshot: EventTileViewModelSnapshot;
    /** EventTile root render state. */
    root: {
        /** EventTile root CSS classes. */
        className: string;
        /** EventTile aria-live value. */
        ariaLive?: "off";
        /** Stable scroll token for the event. */
        scrollToken?: string;
        /** Whether the tile is rendering as a notification. */
        isRenderingNotification: boolean;
    };
    /** EventTile line render state. */
    line: {
        /** EventTile line CSS classes. */
        className: string;
    };
    /** EventTile timestamp render state. */
    timestamp: EventTileTimestampSnapshot;
    /** EventTile E2E padlock slot state. */
    e2ePadlock: {
        /** Whether the padlock should render in the group-layout timestamp area. */
        showInGroupLine: boolean;
        /** Whether the padlock should render in the IRC-layout timestamp area. */
        showInIrcLine: boolean;
    };
}

/** Derives the current EventTile snapshot from component-owned inputs. */
export class EventTileViewModel {
    /** Derives render-ready EventTile state from component-owned inputs. */
    public static createRenderState(props: EventTileViewModelProps): EventTileRenderState {
        const snapshot = EventTileViewModel.createSnapshot(props);
        const useIRCLayout = snapshot.timestamp.displayState.useIRCLayout;
        const showPadlock = !props.display.isBubbleMessage;

        return {
            snapshot,
            root: {
                className: classNames(snapshot.root.classState),
                ariaLive: snapshot.root.ariaLive,
                scrollToken: snapshot.root.scrollToken,
                isRenderingNotification: snapshot.event.isRenderingNotification,
            },
            line: {
                className: classNames("mx_EventTile_line", snapshot.line.classState),
            },
            timestamp: snapshot.timestamp,
            e2ePadlock: {
                showInGroupLine: !useIRCLayout && showPadlock,
                showInIrcLine: useIRCLayout && showPadlock,
            },
        };
    }

    /** Creates an EventTile view model snapshot. */
    public static createSnapshot(props: EventTileViewModelProps): EventTileViewModelSnapshot {
        const { event, display, interaction, sender, timestamp, footer } = props;
        const eventType = event.mxEvent.getType();
        const msgtype = event.mxEvent.getContent().msgtype;
        const isSending = isSendingStatus(event.eventSendStatus ?? undefined);
        const isContinuation = getIsContinuation(display.continuation, display.timelineRenderingType, display.layout);
        const isRenderingNotification = display.timelineRenderingType === TimelineRenderingType.Notification;
        const eventSnapshot: EventTileEventSnapshot = {
            eventType,
            msgtype,
            isSending,
            isEditing: event.isEditing,
            isContinuation,
            isRenderingNotification,
        };
        const senderProfileState = getEventTileSenderProfileState({
            isRenderingNotification,
            isInfoMessage: display.isInfoMessage,
            timelineRenderingType: display.timelineRenderingType,
            continuation: display.continuation,
            eventType,
            isBubbleMessage: display.isBubbleMessage,
            layout: display.layout,
        });
        const showTimestamp = getShouldShowTimestamp({
            eventTs: event.mxEvent.getTs(),
            eventType,
            hideTimestamp: timestamp.hideTimestamp,
            alwaysShowTimestamps: timestamp.alwaysShowTimestamps,
            last: display.isLast,
            hover: interaction.hover,
            focusWithin: interaction.focusWithin,
            actionBarFocused: interaction.isActionBarFocused,
            hasContextMenu: interaction.hasContextMenu,
        });
        const timestampValue = getEventTileTimestamp({
            timelineRenderingType: display.timelineRenderingType,
            eventTs: event.mxEvent.getTs(),
            threadReplyEventTs: timestamp.threadReplyEventTs,
        });

        return {
            event: eventSnapshot,
            root: {
                ariaLive: getAriaLive(event.eventSendStatus),
                scrollToken: getScrollToken(event.mxEvent),
                classState: EventTileViewModel.getClassState({
                    event,
                    display,
                    interaction,
                    sender,
                    eventType,
                    msgtype,
                    isSending,
                    isContinuation,
                    isRenderingNotification,
                }),
            },
            line: {
                classState: getEventTileLineClassState({
                    isProbablyMedia: display.isProbablyMedia,
                    eventType,
                    msgtype,
                }),
            },
            sender: {
                profileState: senderProfileState,
                avatarMember: getEventTileAvatarMember(event.mxEvent),
                viewUserOnClick: getShouldViewUserOnClick(
                    interaction.inhibitInteraction,
                    display.timelineRenderingType,
                ),
                profileMode: getSenderProfileMode({
                    needsSenderProfile: senderProfileState.needsSenderProfile,
                    hideSender: sender.hideSender,
                    timelineRenderingType: display.timelineRenderingType,
                }),
            },
            actionBar: {
                show: getShouldShowMessageActionBar({
                    isEditing: event.isEditing,
                    forExport: event.forExport,
                    hover: interaction.hover,
                    showActionBarFromFocus: interaction.showActionBarFromFocus,
                    actionBarFocused: interaction.isActionBarFocused,
                    hasContextMenu: interaction.hasContextMenu,
                }),
            },
            timestamp: {
                show: showTimestamp,
                value: timestampValue,
                displayState: getTimestampDisplayState({
                    layout: display.layout,
                    showTimestamp,
                    timestamp: timestampValue,
                    hideTimestamp: timestamp.hideTimestamp,
                }),
            },
            replyChain: {
                alwaysShowTimestamps: getReplyChainAlwaysShowTimestamps({
                    alwaysShowTimestamps: timestamp.alwaysShowTimestamps,
                    hover: interaction.hover,
                    focusWithin: interaction.focusWithin,
                }),
            },
            footer: getFooterDisplayState({
                hasReactionsRow: footer.hasReactionsRow,
                hasReactions: footer.hasReactions,
                hasPinnedMessageBadge: footer.hasPinnedMessageBadge,
                layout: display.layout,
                isOwnEvent: footer.isOwnEvent,
            }),
        };
    }

    private static getClassState({
        event,
        display,
        interaction,
        sender,
        eventType,
        msgtype,
        isSending,
        isContinuation,
        isRenderingNotification,
    }: {
        event: EventTileEventInput;
        display: EventTileDisplayInput;
        interaction: EventTileInteractionInput;
        sender: EventTileSenderInput;
        eventType: string;
        msgtype?: string;
        isSending: boolean;
        isContinuation?: boolean;
        isRenderingNotification: boolean;
    }): ReturnType<typeof getEventTileClassState> {
        return getEventTileClassState({
            isBubbleMessage: display.isBubbleMessage,
            isLeftAlignedBubbleMessage: display.isLeftAlignedBubbleMessage,
            isAlignedBetweenBubbles: display.isAlignedBetweenBubbles,
            isEditing: event.isEditing,
            isInfoMessage: display.isInfoMessage,
            isTwelveHour: display.isTwelveHour,
            isSending,
            isHighlighted: display.isHighlighted,
            isSelected: display.isSelected,
            isContinuation,
            eventType,
            isLast: display.isLast,
            isLastInSection: display.isLastInSection,
            isContextual: display.isContextual,
            isActionBarFocused: interaction.isActionBarFocused,
            isEncryptionFailure: event.isEncryptionFailure,
            msgtype,
            hideSender: sender.hideSender,
            timelineRenderingType: display.timelineRenderingType,
            isRenderingNotification,
            noBubbleEvent: display.noBubbleEvent,
        });
    }

    private constructor() {}
}
