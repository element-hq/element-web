/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import { BaseViewModel } from "@element-hq/web-shared-components";

import {
    type EventTileSenderProfileState,
    type FooterDisplayState,
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
    type SenderProfileMode,
    type TimestampDisplayState,
} from "./EventTileDerivedState";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { type Layout } from "../../../../settings/enums/Layout";
import { MessageTimestampViewModel, type MessageTimestampViewModelProps } from "./timestamp/MessageTimestampViewModel";
import {
    ThreadMessagePreviewViewModel,
    type ThreadMessagePreviewViewModelProps,
    ThreadSummaryViewModel,
    type ThreadSummaryViewModelProps,
} from "./ThreadSummaryViewModel.tsx";
import {
    E2eMessageSharedIconViewModel,
    type E2eMessageSharedIconViewModelProps,
} from "./E2eMessageSharedIconViewModel";
import { EventPreviewViewModel, type EventPreviewViewModelProps } from "./EventPreviewViewModel";
import {
    ThreadListActionBarViewModel,
    type ThreadListActionBarViewModelProps,
} from "../../ThreadListActionBarViewModel";
import { EventTileActionBarViewModel, type EventTileActionBarViewModelProps } from "../../EventTileActionBarViewModel";
import { ReactionsRowViewModel, type ReactionsRowViewModelProps } from "./reactions/ReactionsRowViewModel";

/** Event-level inputs for deriving the EventTile snapshot. */
export interface EventTileEventInput {
    /** The event type rendered by the tile. */
    eventType: string;
    /** The Matrix message type rendered by the tile. */
    msgtype?: string;
    /** The event origin timestamp. */
    eventTs: number;
    /** The stable event identifier, when available. */
    eventId?: string;
    /** Whether the event is a local echo. */
    isLocalEcho: boolean;
    /** Whether the event is in a pending send state. */
    isSending: boolean;
    /** Whether EventTile should announce updates in an aria-live region. */
    ariaLive?: "off";
    /** Whether the event is a room create event. */
    isRoomCreate: boolean;
    /** Whether the event is a call invite. */
    isCallInvite: boolean;
    /** Whether the event is an RTC notification. */
    isRtcNotification: boolean;
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
    /** Whether clicking the avatar should open the user profile. */
    viewUserOnClick: boolean;
    /** SenderProfile rendering mode. */
    profileMode: SenderProfileMode;
    /** Whether the avatar should use historical room member details. */
    forceHistoricalAvatar: boolean;
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
    timestamp: EventTileTimestampSnapshot & {
        /** Whether EventTile should render the placeholder timestamp used by IRC layout. */
        showDummy: boolean;
        /** Whether the timestamp slot belongs in the group-layout line. */
        showInGroupLine: boolean;
        /** Whether the timestamp slot belongs in the IRC-layout line. */
        showInIrcLine: boolean;
    };
    /** EventTile E2E padlock slot state. */
    e2ePadlock: {
        /** Whether the padlock should render in the group-layout timestamp area. */
        showInGroupLine: boolean;
        /** Whether the padlock should render in the IRC-layout timestamp area. */
        showInIrcLine: boolean;
    };
    /** EventTile footer slot state. */
    footer: EventTileFooterSnapshot & {
        /** Whether the footer belongs inside the IRC-layout message line. */
        showInIrcLayout: boolean;
        /** Whether the footer belongs below the message line. */
        showInDefaultLayout: boolean;
    };
}

/** Derives the current EventTile snapshot from component-owned inputs. */
export class EventTileViewModel extends BaseViewModel<EventTileRenderState, EventTileViewModelProps> {
    private messageTimestampViewModel?: MessageTimestampViewModel;
    private linkedMessageTimestampViewModel?: MessageTimestampViewModel;
    private threadMessagePreviewViewModel?: ThreadMessagePreviewViewModel;
    private threadSummaryViewModel?: ThreadSummaryViewModel;
    private threadListActionBarViewModel?: ThreadListActionBarViewModel;
    private e2eMessageSharedIconViewModel?: E2eMessageSharedIconViewModel;
    private eventPreviewViewModel?: EventPreviewViewModel;
    private actionBarViewModel?: EventTileActionBarViewModel;
    private reactionsRowViewModel?: ReactionsRowViewModel;

    public constructor(props: EventTileViewModelProps) {
        const initialRenderState = EventTileViewModel.createRenderState(props);

        super(props, initialRenderState);
    }

    /** Updates root EventTile inputs and refreshes the derived render state. */
    public setProps(props: EventTileViewModelProps): void {
        this.props = props;
        this.snapshot.set(EventTileViewModel.createRenderState(props));
    }

    public override dispose(): void {
        this.messageTimestampViewModel?.dispose();
        this.linkedMessageTimestampViewModel?.dispose();
        this.threadMessagePreviewViewModel?.dispose();
        this.threadSummaryViewModel?.dispose();
        this.threadListActionBarViewModel?.dispose();
        this.e2eMessageSharedIconViewModel?.dispose();
        this.eventPreviewViewModel?.dispose();
        this.actionBarViewModel?.dispose();
        this.reactionsRowViewModel?.dispose();
        super.dispose();
    }

    /** Lazily creates and returns the plain timestamp child view model. */
    public getMessageTimestampViewModel(props: MessageTimestampViewModelProps): MessageTimestampViewModel {
        this.messageTimestampViewModel ??= new MessageTimestampViewModel(props);
        return this.messageTimestampViewModel;
    }

    /** Lazily creates and returns the permalink timestamp child view model. */
    public getLinkedMessageTimestampViewModel(props: MessageTimestampViewModelProps): MessageTimestampViewModel {
        this.linkedMessageTimestampViewModel ??= new MessageTimestampViewModel(props);
        return this.linkedMessageTimestampViewModel;
    }

    /** Lazily creates and returns the thread message preview child view model. */
    public getThreadMessagePreviewViewModel(props: ThreadMessagePreviewViewModelProps): ThreadMessagePreviewViewModel {
        this.threadMessagePreviewViewModel ??= new ThreadMessagePreviewViewModel(props);
        return this.threadMessagePreviewViewModel;
    }

    /** Releases the thread message preview child view model when its adapter unmounts. */
    public releaseThreadMessagePreviewViewModel(): void {
        this.threadMessagePreviewViewModel?.dispose();
        this.threadMessagePreviewViewModel = undefined;
    }

    /** Lazily creates and returns the thread summary child view model. */
    public getThreadSummaryViewModel(props: ThreadSummaryViewModelProps): ThreadSummaryViewModel {
        this.threadSummaryViewModel ??= new ThreadSummaryViewModel(props);
        return this.threadSummaryViewModel;
    }

    /** Releases the thread summary child view model when its adapter unmounts. */
    public releaseThreadSummaryViewModel(): void {
        this.threadSummaryViewModel?.dispose();
        this.threadSummaryViewModel = undefined;
    }

    /** Lazily creates and returns the thread-list action bar child view model. */
    public getThreadListActionBarViewModel(props: ThreadListActionBarViewModelProps): ThreadListActionBarViewModel {
        this.threadListActionBarViewModel ??= new ThreadListActionBarViewModel(props);
        return this.threadListActionBarViewModel;
    }

    /** Lazily creates and returns the E2E message-shared icon child view model. */
    public getE2eMessageSharedIconViewModel(props: E2eMessageSharedIconViewModelProps): E2eMessageSharedIconViewModel {
        this.e2eMessageSharedIconViewModel ??= new E2eMessageSharedIconViewModel(props);
        return this.e2eMessageSharedIconViewModel;
    }

    /** Releases the E2E message-shared icon child view model when its adapter unmounts. */
    public releaseE2eMessageSharedIconViewModel(): void {
        this.e2eMessageSharedIconViewModel?.dispose();
        this.e2eMessageSharedIconViewModel = undefined;
    }

    /** Lazily creates and returns the event preview child view model. */
    public getEventPreviewViewModel(props: EventPreviewViewModelProps): EventPreviewViewModel {
        this.eventPreviewViewModel ??= new EventPreviewViewModel(props);
        return this.eventPreviewViewModel;
    }

    /** Releases the event preview child view model when its adapter unmounts. */
    public releaseEventPreviewViewModel(): void {
        this.eventPreviewViewModel?.dispose();
        this.eventPreviewViewModel = undefined;
    }

    /** Lazily creates and returns the event action bar child view model. */
    public getActionBarViewModel(props: EventTileActionBarViewModelProps): EventTileActionBarViewModel {
        this.actionBarViewModel ??= new EventTileActionBarViewModel(props);
        return this.actionBarViewModel;
    }

    /** Releases the event action bar child view model when its adapter unmounts. */
    public releaseActionBarViewModel(): void {
        this.actionBarViewModel?.dispose();
        this.actionBarViewModel = undefined;
    }

    /** Lazily creates and returns the reactions row child view model. */
    public getReactionsRowViewModel(props: ReactionsRowViewModelProps): ReactionsRowViewModel {
        this.reactionsRowViewModel ??= new ReactionsRowViewModel(props);
        return this.reactionsRowViewModel;
    }

    /** Releases the reactions row child view model when its adapter unmounts. */
    public releaseReactionsRowViewModel(): void {
        this.reactionsRowViewModel?.dispose();
        this.reactionsRowViewModel = undefined;
    }

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
            timestamp: {
                ...snapshot.timestamp,
                showDummy: useIRCLayout,
                showInGroupLine: !useIRCLayout,
                showInIrcLine: useIRCLayout,
            },
            e2ePadlock: {
                showInGroupLine: !useIRCLayout && showPadlock,
                showInIrcLine: useIRCLayout && showPadlock,
            },
            footer: {
                ...snapshot.footer,
                showInIrcLayout: useIRCLayout,
                showInDefaultLayout: !useIRCLayout,
            },
        };
    }

    /** Creates an EventTile view model snapshot. */
    public static createSnapshot(props: EventTileViewModelProps): EventTileViewModelSnapshot {
        const { event, display, interaction, sender, timestamp, footer } = props;
        const isContinuation = getIsContinuation(display.continuation, display.timelineRenderingType, display.layout);
        const isRenderingNotification = display.timelineRenderingType === TimelineRenderingType.Notification;
        const eventSnapshot: EventTileEventSnapshot = {
            eventType: event.eventType,
            msgtype: event.msgtype,
            isSending: event.isSending,
            isEditing: event.isEditing,
            isContinuation,
            isRenderingNotification,
        };
        const senderProfileState = getEventTileSenderProfileState({
            isRenderingNotification,
            isInfoMessage: display.isInfoMessage,
            timelineRenderingType: display.timelineRenderingType,
            continuation: display.continuation,
            eventType: event.eventType,
            isBubbleMessage: display.isBubbleMessage,
            layout: display.layout,
            isRoomCreate: event.isRoomCreate,
            isCallInvite: event.isCallInvite,
            isRtcNotification: event.isRtcNotification,
        });
        const showTimestamp = getShouldShowTimestamp({
            eventTs: event.eventTs,
            isRtcNotification: event.isRtcNotification,
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
            eventTs: event.eventTs,
            threadReplyEventTs: timestamp.threadReplyEventTs,
        });

        return {
            event: eventSnapshot,
            root: {
                ariaLive: event.ariaLive,
                scrollToken: getScrollToken({
                    eventId: event.eventId,
                    isLocalEcho: event.isLocalEcho,
                }),
                classState: EventTileViewModel.getClassState({
                    event,
                    display,
                    interaction,
                    sender,
                    eventType: event.eventType,
                    msgtype: event.msgtype,
                    isSending: event.isSending,
                    isCallInvite: event.isCallInvite,
                    isContinuation,
                    isRenderingNotification,
                }),
            },
            line: {
                classState: getEventTileLineClassState({
                    isProbablyMedia: display.isProbablyMedia,
                    eventType: event.eventType,
                    msgtype: event.msgtype,
                }),
            },
            sender: {
                profileState: senderProfileState,
                viewUserOnClick: getShouldViewUserOnClick(
                    interaction.inhibitInteraction,
                    display.timelineRenderingType,
                ),
                profileMode: getSenderProfileMode({
                    needsSenderProfile: senderProfileState.needsSenderProfile,
                    hideSender: sender.hideSender,
                    timelineRenderingType: display.timelineRenderingType,
                }),
                forceHistoricalAvatar: event.eventType === "m.room.member",
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
        isCallInvite,
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
        isCallInvite: boolean;
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
            isCallInvite,
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
}
