/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    BaseViewModel,
    type EventTileRenderingMode,
    type EventTileViewClassNames,
    type EventTileViewLine,
    type EventTileViewRoot,
} from "@element-hq/web-shared-components";
import { EventType, MsgType, type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { ElementCallEventType } from "../../../../call-types";
import {
    type EventTileSenderProfileState,
    type FooterDisplayState,
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
import { type MemberInfo } from "./DisambiguatedProfileViewModel";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { type Layout } from "../../../../settings/enums/Layout";
import { MessageTimestampViewModel, type MessageTimestampViewModelProps } from "./timestamp/MessageTimestampViewModel";
import {
    ThreadMessagePreviewViewModel,
    type ThreadMessagePreviewViewModelProps,
    ThreadSummaryViewModel,
    type ThreadSummaryViewModelProps,
} from "./ThreadSummaryViewModel";
import {
    E2eMessageSharedIconViewModel,
    type E2eMessageSharedIconViewModelProps,
} from "./E2eMessageSharedIconViewModel";
import { EventPreviewViewModel, type EventPreviewViewModelProps } from "./EventPreviewViewModel";
import { getEventTileReplyChainState } from "./EventTileReplyChainState";
import { getEventDisplayInfo } from "../../../../utils/EventRenderingUtils";
import { haveRendererForEvent } from "../../../../events/EventTileFactory";
import {
    ThreadListActionBarViewModel,
    type ThreadListActionBarViewModelProps,
} from "../../ThreadListActionBarViewModel";
import { EventTileActionBarViewModel, type EventTileActionBarViewModelProps } from "../../EventTileActionBarViewModel";
import { ReactionsRowViewModel, type ReactionsRowViewModelProps } from "./reactions/ReactionsRowViewModel";

/** Event-level inputs for deriving the EventTile snapshot. */
export interface EventTileEventInput {
    /** Whether the event is in a pending send state. */
    isSending: boolean;
    /** Whether EventTile should announce updates in an aria-live region. */
    ariaLive?: "off";
    /** Whether the event is currently being edited. */
    isEditing: boolean;
    /** Whether the tile is rendering for export. */
    forExport?: boolean;
}

/** Event-level inputs after SDK data has been converted to pure values. */
export interface EventTileDerivedEventInput extends EventTileEventInput {
    /** The event type rendered by the tile. */
    eventType: string;
    /** The Matrix message type rendered by the tile. */
    msgtype?: string;
    /** The event origin timestamp. */
    eventTs: number;
    /** The stable event identifier, when available. */
    eventId?: string;
    /** The event identifier replaced by this event, when available. */
    replacingEventId?: string;
    /** Whether the event is a state event. */
    isState: boolean;
    /** Whether the event is a local echo. */
    isLocalEcho: boolean;
    /** Whether the event is a room create event. */
    isRoomCreate: boolean;
    /** Whether the event is a call invite. */
    isCallInvite: boolean;
    /** Whether the event is an RTC notification. */
    isRtcNotification: boolean;
    /** Whether the event failed decryption. */
    isEncryptionFailure: boolean;
    /** Whether a renderer is available for the event. */
    hasRenderer: boolean;
    /** Whether the event should be rendered through the moderation fallback. */
    isSeeingThroughMessageHiddenForModeration: boolean;
    /** Whether EventTile should render the reply chain. */
    hasReplyChain: boolean;
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
    isBubbleMessage?: boolean;
    /** Whether the bubble tile is left-aligned. */
    isLeftAlignedBubbleMessage?: boolean;
    /** Whether the event is aligned between bubble columns. */
    isAlignedBetweenBubbles?: boolean;
    /** Whether the event renders as an informational timeline item. */
    isInfoMessage?: boolean;
    /** Whether bubble styling should be suppressed for this event. */
    noBubbleEvent?: boolean;
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

/** Event display inputs after renderer and event display information has been normalized. */
export interface EventTileDerivedDisplayInput extends EventTileDisplayInput {
    isBubbleMessage: boolean;
    isLeftAlignedBubbleMessage: boolean;
    isAlignedBetweenBubbles: boolean;
    isInfoMessage: boolean;
    noBubbleEvent: boolean;
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
    /** The Matrix sender ID, when available. */
    senderId?: string;
    /** Plain member info for sender/profile rendering. */
    member: MemberInfo | null;
    /** Whether sender details should be hidden. */
    hideSender?: boolean;
    /** Whether the event body renders as an emote. */
    isEmote?: boolean;
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
    /** Optional shared shell shape override for host-specific timeline surfaces. */
    shape?: EventTileRenderingMode;
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

/** Pure EventTile inputs after event and sender data has been normalized. */
export interface NormalizedEventTileViewModelProps {
    /** Optional shared shell shape override for host-specific timeline surfaces. */
    shape?: EventTileRenderingMode;
    event: EventTileDerivedEventInput;
    display: EventTileDerivedDisplayInput;
    interaction: EventTileInteractionInput;
    sender: EventTileSenderInput;
    timestamp: EventTileTimestampInput;
    footer: EventTileFooterInput;
}

/** Application dependencies used by EventTileViewModel to derive render data. */
export interface EventTileViewModelDependencies {
    /** The Matrix event being rendered. */
    mxEvent: MatrixEvent;
    /** Matrix client used to select the event renderer. */
    matrixClient: MatrixClient;
    /** Whether hidden events should use their fallback renderer. */
    showHiddenEvents: boolean;
    /** Whether the event is hidden by the current tile context. */
    hideEvent?: boolean;
}

/** Event-level state derived for the EventTile snapshot. */
export interface EventTileEventSnapshot {
    /** The Matrix event type. */
    eventType: string;
    /** The Matrix message type. */
    msgtype?: string;
    /** The stable event identifier, when available. */
    eventId?: string;
    /** The event identifier replaced by this event, when available. */
    replacingEventId?: string;
    /** Whether the event is a state event. */
    isState: boolean;
    /** The event origin timestamp. */
    eventTs: number;
    /** Whether the event is a local echo. */
    isLocalEcho: boolean;
    /** Whether the event is in a pending send state. */
    isSending: boolean;
    /** Whether the event is currently being edited. */
    isEditing: boolean;
    /** Whether EventTile should render as a continuation. */
    isContinuation?: boolean;
    /** Whether the tile is rendering as a notification. */
    isRenderingNotification: boolean;
    /** Whether the event failed decryption. */
    isEncryptionFailure: boolean;
    /** Whether a renderer is available for the event. */
    hasRenderer: boolean;
    /** Whether the event should be rendered through the moderation fallback. */
    isSeeingThroughMessageHiddenForModeration: boolean;
}

/** Root state derived for the EventTile snapshot, aligned with EventTileView. */
export type EventTileRootSnapshot = Omit<EventTileViewRoot, "id" | "as" | "permalink">;

/** Fixed application class names for the shared EventTileView shell. */
const EVENT_TILE_VIEW_CLASS_NAMES: EventTileViewClassNames = {
    root: "mx_EventTile",
    line: "mx_EventTile_line",
};

/** Sender state derived for the EventTile snapshot. */
export interface EventTileSenderSnapshot {
    /** The Matrix sender ID, when available. */
    senderId?: string;
    /** Plain member info for sender/profile rendering. */
    member: MemberInfo | null;
    /** EventTile avatar and sender profile display state. */
    profileState: EventTileSenderProfileState;
    /** Whether clicking the avatar should open the user profile. */
    viewUserOnClick: boolean;
    /** SenderProfile rendering mode. */
    profileMode: SenderProfileMode;
    /** Whether the avatar should use historical room member details. */
    forceHistoricalAvatar: boolean;
    /** Whether the event body renders as an emote. */
    isEmote: boolean;
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
    /** Line state consumed directly by the shared EventTileView shell. */
    line: EventTileViewLine;
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

/**
 * Aggregate application-side render state consumed by EventTileView.
 *
 * The root and classNames fields intentionally follow the shared EventTileView
 * boundary. React slots, handlers, refs, and runtime DOM identity remain with
 * the application component that composes EventTileView.
 */
export interface EventTileViewModelRenderState {
    /** Application snapshot still used to build the event-specific slots. */
    snapshot: EventTileViewModelSnapshot;
    /** Root state consumed directly by the shared EventTileView shell. */
    root: Omit<EventTileViewRoot, "id" | "as" | "permalink">;
    /** Line state consumed directly by the shared EventTileView shell. */
    line: EventTileViewLine;
    /** Application class names consumed by the shared EventTileView shell. */
    classNames: EventTileViewClassNames;
    /** EventTile timestamp render state. */
    timestamp: EventTileTimestampSnapshot;
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

/**
 * Aggregate application-side render-state boundary for EventTile.
 *
 * SDK objects are converted to plain render data here before the application render tree consumes it.
 */
export class EventTileViewModel extends BaseViewModel<EventTileViewModelRenderState, EventTileViewModelProps> {
    private messageTimestampViewModel?: MessageTimestampViewModel;
    private linkedMessageTimestampViewModel?: MessageTimestampViewModel;
    private threadMessagePreviewViewModel?: ThreadMessagePreviewViewModel;
    private threadSummaryViewModel?: ThreadSummaryViewModel;
    private threadListActionBarViewModel?: ThreadListActionBarViewModel;
    private e2eMessageSharedIconViewModel?: E2eMessageSharedIconViewModel;
    private eventPreviewViewModel?: EventPreviewViewModel;
    private actionBarViewModel?: EventTileActionBarViewModel;
    private reactionsRowViewModel?: ReactionsRowViewModel;

    public constructor(dependencies: EventTileViewModelDependencies, props: EventTileViewModelProps) {
        const normalizedProps = EventTileViewModel.normalizeDependencies(dependencies, props);
        const initialRenderState = EventTileViewModel.createRenderState(normalizedProps);

        super(normalizedProps, initialRenderState);
    }

    /** Updates dependencies and root inputs together, emitting one consistent render state. */
    public setInputs(dependencies: EventTileViewModelDependencies, props: EventTileViewModelProps): void {
        const normalizedProps = EventTileViewModel.normalizeDependencies(dependencies, props);
        this.props = normalizedProps;
        this.snapshot.set(EventTileViewModel.createRenderState(normalizedProps));
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
    public static createRenderState(props: NormalizedEventTileViewModelProps): EventTileViewModelRenderState {
        const snapshot = EventTileViewModel.createSnapshot(props);
        const useIRCLayout = snapshot.timestamp.displayState.useIRCLayout;
        const showPadlock = !props.display.isBubbleMessage;

        return {
            snapshot,
            root: snapshot.root,
            line: snapshot.line,
            classNames: EVENT_TILE_VIEW_CLASS_NAMES,
            timestamp: snapshot.timestamp,
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

    /**
     * Derives pure inputs from application dependencies while keeping the VM's public props SDK-free.
     */
    private static normalizeDependencies(
        dependencies: EventTileViewModelDependencies,
        props: EventTileViewModelProps,
    ): NormalizedEventTileViewModelProps {
        const { mxEvent } = dependencies;
        const eventType = mxEvent.getType();
        const displayInfo = getEventDisplayInfo(
            dependencies.matrixClient,
            mxEvent,
            dependencies.showHiddenEvents,
            dependencies.hideEvent,
        );
        const replyChainState = getEventTileReplyChainState({
            mxEvent,
            // Replacement events have a fallback tile but must not show their own reply chain
            hasRenderer: haveRendererForEvent(mxEvent, dependencies.matrixClient, dependencies.showHiddenEvents),
        });

        return {
            ...props,
            event: {
                ...props.event,
                eventType,
                msgtype: mxEvent.getContent().msgtype,
                eventTs: mxEvent.getTs(),
                eventId: mxEvent.getId() ?? undefined,
                replacingEventId: mxEvent.replacingEventId() ?? undefined,
                isState: mxEvent.isState(),
                isLocalEcho: !!mxEvent.status,
                isRoomCreate: eventType === EventType.RoomCreate,
                isCallInvite: eventType === EventType.CallInvite,
                isRtcNotification: eventType === EventType.RTCNotification,
                isEncryptionFailure: mxEvent.isDecryptionFailure(),
                hasRenderer: displayInfo.hasRenderer,
                isSeeingThroughMessageHiddenForModeration: displayInfo.isSeeingThroughMessageHiddenForModeration,
                hasReplyChain: replyChainState.shouldShowReplyChain,
            },
            display: {
                ...props.display,
                ...displayInfo,
            },
            sender: {
                ...props.sender,
                senderId: mxEvent.getSender() ?? undefined,
                isEmote: mxEvent.getContent().msgtype === MsgType.Emote,
            },
        };
    }

    /** Creates an EventTile view model snapshot. */
    public static createSnapshot(props: NormalizedEventTileViewModelProps): EventTileViewModelSnapshot {
        const { event, display, interaction, sender, timestamp, footer } = props;
        const isContinuation = getIsContinuation(display.continuation, display.timelineRenderingType, display.layout);
        const isRenderingNotification = display.timelineRenderingType === TimelineRenderingType.Notification;
        const eventSnapshot: EventTileEventSnapshot = {
            eventType: event.eventType,
            msgtype: event.msgtype,
            eventId: event.eventId,
            replacingEventId: event.replacingEventId,
            isState: event.isState,
            eventTs: event.eventTs,
            isLocalEcho: event.isLocalEcho,
            isSending: event.isSending,
            isEditing: event.isEditing,
            isContinuation,
            isRenderingNotification,
            isEncryptionFailure: event.isEncryptionFailure,
            hasRenderer: event.hasRenderer,
            isSeeingThroughMessageHiddenForModeration: event.isSeeingThroughMessageHiddenForModeration,
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
        const scrollToken = getScrollToken({
            eventId: event.eventId,
            isLocalEcho: event.isLocalEcho,
        });
        const rootState: EventTileRootSnapshot["state"] = {
            isOwnEvent: footer.isOwnEvent,
            hasReply: event.hasReplyChain,
            info: display.isInfoMessage,
            bubbleContainer: display.isBubbleMessage,
            leftAlignedBubble: display.isLeftAlignedBubbleMessage,
            alignedBetweenBubbles: display.isAlignedBetweenBubbles,
            noBubble: display.noBubbleEvent,
            noSender: sender.hideSender,
            encryptionFailure: event.isEncryptionFailure,
            emote: sender.isEmote,
            highlighted: display.isHighlighted,
            selected: display.isSelected,
            editing: event.isEditing,
            continuation: isContinuation || event.isCallInvite || ElementCallEventType.matches(event.eventType),
            lastInSection: display.isLastInSection,
            contextual: display.isContextual,
            actionBarFocused: interaction.isActionBarFocused,
            previewClamped:
                display.timelineRenderingType === TimelineRenderingType.ThreadsList || isRenderingNotification,
        };
        const lineState: EventTileViewLine = {
            media: display.isProbablyMedia,
            sticker: event.eventType === "m.sticker",
            emote: sender.isEmote,
            image: event.eventType === EventType.RoomMessage && event.msgtype === MsgType.Image,
        };
        return {
            event: eventSnapshot,
            root: {
                ariaLive: event.ariaLive,
                scrollToken,
                eventId: event.eventId,
                shape: props.shape ?? EventTileViewModel.toEventTileViewShape(display.timelineRenderingType),
                state: rootState,
            },
            line: lineState,
            sender: {
                senderId: sender.senderId,
                member: sender.member ?? null,
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
                isEmote: sender.isEmote ?? false,
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

    private static toEventTileViewShape(shape: TimelineRenderingType): EventTileRenderingMode {
        switch (shape) {
            case TimelineRenderingType.Thread:
                return "Thread";
            case TimelineRenderingType.ThreadsList:
                return "ThreadsList";
            case TimelineRenderingType.File:
                return "File";
            case TimelineRenderingType.Notification:
                return "Notification";
            case TimelineRenderingType.Search:
                return "Search";
            case TimelineRenderingType.Pinned:
                return "Pinned";
            case TimelineRenderingType.Room:
            default:
                return "Room";
        }
    }
}
