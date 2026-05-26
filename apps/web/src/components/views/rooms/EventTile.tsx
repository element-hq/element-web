/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    createRef,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type JSX,
    type Ref,
    type FocusEvent,
    type MouseEvent,
    type ReactNode,
} from "react";
import {
    type EventStatus,
    EventType,
    type MatrixEvent,
    MatrixEventEvent,
    type Relations,
    type Room,
    RelationsEvent,
    RoomEvent,
    type RoomMember,
    type Thread,
    ThreadEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { CallErrorCode } from "matrix-js-sdk/src/webrtc/call";
import { Tooltip } from "@vector-im/compound-web";
import { uniqueId, uniqBy } from "lodash";
import { CircleIcon, CheckCircleIcon, ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import {
    useCreateAutoDisposedViewModel,
    ActionBarView,
    MessageTimestampView,
    PinnedMessageBadge,
    ReactionsRowButtonView,
    ReactionsRowView,
    TileErrorView,
    useViewModel,
} from "@element-hq/web-shared-components";

import ReplyChain from "../elements/ReplyChain";
import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { Layout } from "../../../settings/enums/Layout";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import RoomAvatar from "../avatars/RoomAvatar";
import MessageContextMenu from "../context_menus/MessageContextMenu";
import ContextMenu, { aboveLeftOf, aboveRightOf } from "../../structures/ContextMenu";
import { objectHasDiff } from "../../../utils/objects";
import type EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { StaticNotificationState } from "../../../stores/notifications/StaticNotificationState";
import NotificationBadge from "./NotificationBadge";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";
import { type ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../dispatcher/actions";
import PlatformPeg from "../../../PlatformPeg";
import MemberAvatar from "../avatars/MemberAvatar";
import SenderProfile from "../messages/SenderProfile";
import { type IReadReceiptPosition } from "./ReadReceiptMarker";
import ReactionPicker from "../emojipicker/ReactionPicker";
import { getEventDisplayInfo } from "../../../utils/EventRenderingUtils";
import { isContentActionable } from "../../../utils/EventUtils";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { copyPlaintext } from "../../../utils/strings";
import { DecryptionFailureTracker } from "../../../DecryptionFailureTracker";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import PosthogTrackers from "../../../PosthogTrackers";
import { haveRendererForEvent, isMessageEvent, renderTile } from "../../../events/EventTileFactory";
import ThreadSummary, { ThreadMessagePreview } from "./ThreadSummary";
import { ReadReceiptGroup } from "./ReadReceiptGroup";
import { type ShowThreadPayload } from "../../../dispatcher/payloads/ShowThreadPayload";
import { UnreadNotificationBadge } from "./NotificationBadge/UnreadNotificationBadge";
import { getLateEventInfo } from "../../structures/grouper/LateEventGrouper";
import { Icon as LateIcon } from "../../../../res/img/sensor.svg";
import PinningUtils from "../../../utils/PinningUtils";
import { EventPreview } from "./EventPreview";
import { E2eStandardPadlockIcon } from "./EventTile/E2eStandardPadlockIcon";
import { E2eMessageSharedIcon } from "./EventTile/E2eMessageSharedIcon";
import SettingsStore from "../../../settings/SettingsStore";
import { CardContext } from "../right_panel/context";
import { EventTileViewModel } from "../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import {
    getEventTileReceiptState,
    type EventTileReceiptState,
} from "../../../viewmodels/room/timeline/event-tile/EventTileReceiptState";
import {
    getEventTileThread,
    getEventTileThreadState,
    type EventTileThreadState,
} from "../../../viewmodels/room/timeline/event-tile/EventTileThreadState";
import { getEventTileReplyChainState } from "../../../viewmodels/room/timeline/event-tile/EventTileReplyChainState";
import {
    eventTileActionBarFocusChange,
    eventTileBlurWithin,
    eventTileClearHover,
    eventTileCloseContextMenu,
    eventTileFocusWithin,
    eventTileMouseEnter,
    eventTileMouseLeave,
    eventTileOpenContextMenu,
    initialEventTileInteractionState,
    type EventTileInteractionState,
} from "../../../viewmodels/room/timeline/event-tile/EventTileInteractionState";
import {
    MessageTimestampViewModel,
    type MessageTimestampViewModelProps,
} from "../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel.ts";
import { ReactionsRowButtonViewModel } from "../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowButtonViewModel";
import {
    MAX_ITEMS_WHEN_LIMITED,
    ReactionsRowViewModel,
} from "../../../viewmodels/room/timeline/event-tile/reactions/ReactionsRowViewModel";
import {
    getEventTileReactionRelations,
    isEventTileReactionRelation,
    type GetRelationsForEvent,
} from "../../../viewmodels/room/timeline/event-tile/reactions/EventTileReactionState";
import { TileErrorViewModel } from "../../../viewmodels/message-body/TileErrorViewModel";
import { EventTileActionBarViewModel } from "../../../viewmodels/room/EventTileActionBarViewModel";
import { ThreadListActionBarViewModel } from "../../../viewmodels/room/ThreadListActionBarViewModel";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { useSettingValue } from "../../../hooks/useSettings";
import { DecryptionFailureBodyFactory, RedactedBodyFactory } from "../messages/MBodyFactory";
import { EventTileE2eViewModel } from "../../../viewmodels/room/timeline/event-tile/EventTileE2eViewModel";

/** Relation lookup type retained for EventTile consumers. */
export type { GetRelationsForEvent } from "../../../viewmodels/room/timeline/event-tile/reactions/EventTileReactionState";

// Our component structure for EventTiles on the timeline is:
//
// .-EventTile------------------------------------------------.
// | MemberAvatar (SenderProfile)                   TimeStamp |
// |    .-{Message,Textual}Event---------------. Read Avatars |
// |    |   .-MFooBody-------------------.     |              |
// |    |   |  (only if MessageEvent)    |     |              |
// |    |   '----------------------------'     |              |
// |    '--------------------------------------'              |
// '----------------------------------------------------------'

export interface IReadReceiptProps {
    userId: string;
    roomMember: RoomMember | null;
    ts: number;
}

export interface IEventTileOps {
    isWidgetHidden(): boolean;
    unhideWidget(): void;
}

export interface IEventTileType extends React.Component<HTMLDivElement> {
    getEventTileOps?(): IEventTileOps;
    getMediaHelper(): MediaEventHelper | undefined;
}

export interface EventTileProps {
    // the MatrixEvent to show
    mxEvent: MatrixEvent;

    // true if mxEvent is redacted. This is a prop because using mxEvent.isRedacted()
    // might not be enough when deciding shouldComponentUpdate - prevProps.mxEvent
    // references the same this.props.mxEvent.
    isRedacted?: boolean;

    // true if this is a continuation of the previous event (which has the
    // effect of not showing another avatar/displayname
    continuation?: boolean;

    // true if this is the last event in the timeline (which has the effect
    // of always showing the timestamp)
    last?: boolean;

    // true if the event is the last event in a section (adds a css class for
    // targeting)
    lastInSection?: boolean;

    // True if the event is the last successful (sent) event.
    lastSuccessful?: boolean;

    // true if this is search context (which has the effect of greying out
    // the text
    contextual?: boolean;

    // a list of words to highlight, ordered by longest first
    highlights?: string[];

    // link URL for the highlights
    highlightLink?: string;

    // should show URL previews for this event
    showUrlPreview?: boolean;

    // is this the focused event
    isSelectedEvent?: boolean;

    resizeObserver?: ResizeObserver;

    // a list of read-receipts we should show. Each object has a 'roomMember' and 'ts'.
    readReceipts?: IReadReceiptProps[];

    // opaque readreceipt info for each userId; used by ReadReceiptMarker
    // to manage its animations. Should be an empty object when the room
    // first loads
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };

    // A function which is used to check if the parent panel is being
    // unmounted, to avoid unnecessary work. Should return true if we
    // are being unmounted.
    checkUnmounting?: () => boolean;

    // the status of this event - ie, mxEvent.status. Denormalised to here so
    // that we can tell when it changes.
    eventSendStatus?: EventStatus;

    forExport?: boolean;

    // show twelve hour timestamps
    isTwelveHour?: boolean;

    // helper function to access relations for this event
    getRelationsForEvent?: GetRelationsForEvent;

    // whether to show reactions for this event
    showReactions?: boolean;

    // which layout to use
    layout?: Layout;

    // whether or not to show read receipts
    showReadReceipts?: boolean;

    // Used while editing, to pass the event, and to preserve editor state
    // from one editor instance to another when remounting the editor
    // upon receiving the remote echo for an unsent event.
    editState?: EditorStateTransfer;

    // Event ID of the event replacing the content of this event, if any
    replacingEventId?: string;

    // Helper to build permalinks for the room
    permalinkCreator?: RoomPermalinkCreator;

    // LegacyCallEventGrouper for this event
    callEventGrouper?: LegacyCallEventGrouper;

    // Symbol of the root node
    as?: string;

    // whether or not to always show timestamps
    alwaysShowTimestamps?: boolean;

    // whether or not to display the sender
    hideSender?: boolean;

    // whether or not to display thread info
    showThreadInfo?: boolean;

    // if specified and `true`, the message is being
    // hidden for moderation from other users but is
    // displayed to the current user either because they're
    // the author or they are a moderator
    isSeeingThroughMessageHiddenForModeration?: boolean;

    // The following properties are used by EventTilePreview to disable tab indexes within the event tile
    hideTimestamp?: boolean;
    inhibitInteraction?: boolean;

    ref?: Ref<UnwrappedEventTile>;
}

interface IState {
    interaction: EventTileInteractionState;

    // The Relations model from the JS SDK for reactions to `mxEvent`
    reactions?: Relations | null | undefined;

    isQuoteExpanded?: boolean;

    thread: Thread | null;
}

// MUST be rendered within a RoomContext with a set timelineRenderingType
export class UnwrappedEventTile extends React.Component<EventTileProps, IState> {
    private suppressReadReceiptAnimation: boolean;
    private isListeningForReceipts: boolean;
    private tile = createRef<IEventTileType>();
    private replyChain = createRef<ReplyChain>();
    private e2eViewModel: EventTileE2eViewModel;
    private e2eViewModelSubscription?: () => void;

    public readonly ref = createRef<HTMLElement>();

    public static defaultProps = {
        forExport: false,
        layout: Layout.Group,
    };

    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private readonly id = uniqueId();
    private staleHoverCheckActive = false;

    public constructor(props: EventTileProps, context: React.ContextType<typeof RoomContext>) {
        super(props, context);

        const thread = getEventTileThread(
            this.props.mxEvent,
            MatrixClientPeg.safeGet().getRoom(this.props.mxEvent.getRoomId()),
        );

        this.state = {
            interaction: initialEventTileInteractionState,

            // The Relations model from the JS SDK for reactions to `mxEvent`
            reactions: this.getReactions(),

            thread,
        };

        this.e2eViewModel = new EventTileE2eViewModel({
            cli: MatrixClientPeg.safeGet(),
            mxEvent: this.props.mxEvent,
            isRoomEncrypted: this.context.isRoomEncrypted,
            eventSendStatus: this.props.eventSendStatus,
            enableListeners: !this.props.forExport,
        });

        // don't do RR animations until we are mounted
        this.suppressReadReceiptAnimation = true;

        // Throughout the component we manage a read receipt listener to see if our tile still
        // qualifies for a "sent" or "sending" state (based on their relevant conditions). We
        // don't want to over-subscribe to the read receipt events being fired, so we use a flag
        // to determine if we've already subscribed and use a combination of other flags to find
        // out if we should even be subscribed at all.
        this.isListeningForReceipts = false;
    }

    private get receiptState(): EventTileReceiptState {
        const client = MatrixClientPeg.safeGet();

        return getEventTileReceiptState({
            mxEvent: this.props.mxEvent,
            readReceipts: this.props.readReceipts,
            hasRoom: !!client.getRoom(this.props.mxEvent.getRoomId()),
            ownUserId: client.getSafeUserId(),
            lastSuccessful: this.props.lastSuccessful,
            eventSendStatus: this.props.eventSendStatus,
            timelineRenderingType: this.context.timelineRenderingType,
        });
    }

    public componentDidMount(): void {
        this.suppressReadReceiptAnimation = false;
        this.e2eViewModelSubscription = this.e2eViewModel.subscribe(() => {
            this.forceUpdate();
        });
        this.e2eViewModel.start();

        const client = MatrixClientPeg.safeGet();
        if (!this.props.forExport) {
            this.props.mxEvent.on(MatrixEventEvent.Decrypted, this.onDecrypted);
            this.props.mxEvent.on(MatrixEventEvent.Replaced, this.onReplaced);
            DecryptionFailureTracker.instance.addVisibleEvent(this.props.mxEvent);
            if (this.props.showReactions) {
                this.props.mxEvent.on(MatrixEventEvent.RelationsCreated, this.onReactionsCreated);
            }

            if (this.receiptState.shouldListenForReceipts) {
                client.on(RoomEvent.Receipt, this.onRoomReceipt);
                this.isListeningForReceipts = true;
            }
        }

        this.props.mxEvent.on(ThreadEvent.Update, this.updateThread);

        client.decryptEventIfNeeded(this.props.mxEvent);

        const room = client.getRoom(this.props.mxEvent.getRoomId());
        room?.on(ThreadEvent.New, this.onNewThread);
    }

    private readonly updateThread = (thread: Thread): void => {
        this.setState({ thread });
    };

    public shouldComponentUpdate(nextProps: EventTileProps, nextState: IState): boolean {
        if (objectHasDiff(this.state, nextState)) {
            return true;
        }

        return !this.propsEqual(this.props, nextProps);
    }

    public componentWillUnmount(): void {
        this.stopStaleHoverCheck();
        const client = MatrixClientPeg.get();
        if (client) {
            client.removeListener(RoomEvent.Receipt, this.onRoomReceipt);
            const room = client.getRoom(this.props.mxEvent.getRoomId());
            room?.off(ThreadEvent.New, this.onNewThread);
        }
        this.isListeningForReceipts = false;
        this.props.mxEvent.removeListener(MatrixEventEvent.Decrypted, this.onDecrypted);
        this.props.mxEvent.removeListener(MatrixEventEvent.Replaced, this.onReplaced);
        if (this.props.showReactions) {
            this.props.mxEvent.removeListener(MatrixEventEvent.RelationsCreated, this.onReactionsCreated);
        }
        this.props.mxEvent.off(ThreadEvent.Update, this.updateThread);
        this.e2eViewModelSubscription?.();
        this.e2eViewModelSubscription = undefined;
        this.e2eViewModel.dispose();
        if (this.props.resizeObserver && this.ref.current) this.props.resizeObserver.unobserve(this.ref.current);
    }

    public componentDidUpdate(_prevProps: Readonly<EventTileProps>, prevState: Readonly<IState>): void {
        // Some overlays, such as portalled tooltips, can interrupt the normal mouseleave path.
        // While hover is active, verify it against the browser's real :hover state on mouse movement.
        if (!prevState.interaction.hover && this.state.interaction.hover) {
            this.startStaleHoverCheck();
        } else if (prevState.interaction.hover && !this.state.interaction.hover) {
            this.stopStaleHoverCheck();
        }

        // If we're not listening for receipts and expect to be, register a listener.
        if (!this.isListeningForReceipts && this.receiptState.shouldListenForReceipts) {
            MatrixClientPeg.safeGet().on(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = true;
        }
        this.e2eViewModel.setProps({
            mxEvent: this.props.mxEvent,
            isRoomEncrypted: this.context.isRoomEncrypted,
            eventSendStatus: this.props.eventSendStatus,
            enableListeners: !this.props.forExport,
        });

        if (this.props.resizeObserver && this.ref.current) this.props.resizeObserver.observe(this.ref.current);

        // Moving between edited messages can remount the editor without a reliable blur event.
        // Clear stale focus-derived action bar state when focus has actually left this tile.
        if (
            this.state.interaction.focusWithin &&
            this.ref.current &&
            document.activeElement instanceof HTMLElement &&
            !this.ref.current.contains(document.activeElement)
        ) {
            this.setState((prevState) => ({
                interaction: eventTileBlurWithin(prevState.interaction),
            }));
        }
    }

    private readonly onNewThread = (thread: Thread): void => {
        if (thread.id === this.props.mxEvent.getId()) {
            this.updateThread(thread);
            const room = MatrixClientPeg.safeGet().getRoom(this.props.mxEvent.getRoomId());
            room?.off(ThreadEvent.New, this.onNewThread);
        }
    };

    private get threadState(): EventTileThreadState {
        return getEventTileThreadState({
            mxEvent: this.props.mxEvent,
            thread: this.state.thread,
            timelineRenderingType: this.context.timelineRenderingType,
            highlightLink: this.props.highlightLink,
        });
    }

    private renderThreadPanelSummary(threadState: EventTileThreadState): JSX.Element | null {
        if (!threadState.shouldShowThreadPanelSummary || !threadState.thread) {
            return null;
        }

        return (
            <div className="mx_ThreadPanel_replies">
                <ThreadsIcon />
                <span className="mx_ThreadPanel_replies_amount">{threadState.thread.length}</span>
                <ThreadMessagePreview thread={threadState.thread} />
            </div>
        );
    }

    private renderThreadInfo(threadState: EventTileThreadState): React.ReactNode {
        if (threadState.shouldShowThreadSummary && threadState.thread) {
            return (
                <ThreadSummary mxEvent={this.props.mxEvent} thread={threadState.thread} data-testid="thread-summary" />
            );
        }

        if (threadState.searchThreadInfo.kind === "link") {
            return (
                <a className="mx_ThreadSummary_icon" href={threadState.searchThreadInfo.href}>
                    <ThreadsIcon />
                    {_t("timeline|thread_info_basic")}
                </a>
            );
        }

        if (threadState.searchThreadInfo.kind === "text") {
            return (
                <p className="mx_ThreadSummary_icon">
                    <ThreadsIcon />
                    {_t("timeline|thread_info_basic")}
                </p>
            );
        }
    }

    private readonly onViewInRoomClick = (_anchor: HTMLElement | null): void => {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
            metricsTrigger: undefined, // room doesn't change
        });
    };

    private readonly onCopyLinkToThreadClick = async (_anchor: HTMLElement | null): Promise<void> => {
        const { permalinkCreator, mxEvent } = this.props;
        if (!permalinkCreator) return;
        const matrixToUrl = permalinkCreator.forEvent(mxEvent.getId()!);
        await copyPlaintext(matrixToUrl);
    };

    private readonly onRoomReceipt = (ev: MatrixEvent, room: Room): void => {
        // ignore events for other rooms
        const tileRoom = MatrixClientPeg.safeGet().getRoom(this.props.mxEvent.getRoomId());
        if (room !== tileRoom) return;

        if (!this.receiptState.shouldListenForReceipts && !this.isListeningForReceipts) {
            return;
        }

        // We force update because we have no state or prop changes to queue up, instead relying on
        // the getters we use here to determine what needs rendering.
        this.forceUpdate(() => {
            // Per elsewhere in this file, we can remove the listener once we will have no further purpose for it.
            if (!this.receiptState.shouldListenForReceipts) {
                MatrixClientPeg.safeGet().removeListener(RoomEvent.Receipt, this.onRoomReceipt);
                this.isListeningForReceipts = false;
            }
        });
    };

    /** called when the event is decrypted after we show it.
     */
    private readonly onDecrypted = (): void => {
        // E2E padlock verification is handled by EventTileE2eViewModel; this refreshes the rest of the tile body.
        this.forceUpdate();
    };

    /** called when the event is edited after we show it. */
    private readonly onReplaced = (): void => {
        // E2E padlock verification is handled by EventTileE2eViewModel; this refreshes the rest of the tile body.
        this.forceUpdate();
    };

    private propsEqual(objA: EventTileProps, objB: EventTileProps): boolean {
        const keysA = Object.keys(objA) as Array<keyof EventTileProps>;
        const keysB = Object.keys(objB) as Array<keyof EventTileProps>;

        if (keysA.length !== keysB.length) {
            return false;
        }

        for (let i = 0; i < keysA.length; i++) {
            const key = keysA[i];

            if (!objB.hasOwnProperty(key)) {
                return false;
            }

            // need to deep-compare readReceipts
            if (key === "readReceipts") {
                const rA = objA[key];
                const rB = objB[key];
                if (rA === rB) {
                    continue;
                }

                if (!rA || !rB) {
                    return false;
                }

                if (rA.length !== rB.length) {
                    return false;
                }
                for (let j = 0; j < rA.length; j++) {
                    if (rA[j].userId !== rB[j].userId) {
                        return false;
                    }
                    // one has a member set and the other doesn't?
                    if (rA[j].roomMember !== rB[j].roomMember) {
                        return false;
                    }
                }
            } else {
                if (objA[key] !== objB[key]) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Determine whether an event should be highlighted
     * For edited events, if a previous version of the event was highlighted
     * the event should remain highlighted as the user may have been notified
     * (Clearer explanation of why an event is highlighted is planned -
     * https://github.com/vector-im/element-web/issues/24927)
     * @returns boolean
     */
    private shouldHighlight(): boolean {
        if (this.props.forExport) return false;
        if (this.context.timelineRenderingType === TimelineRenderingType.Notification) return false;
        if (this.context.timelineRenderingType === TimelineRenderingType.ThreadsList) return false;

        if (this.props.isRedacted) return false;

        // This event is a room mention but we don't want the call tile to have a highlight.
        if (this.props.mxEvent.getType() === EventType.RTCNotification) return false;

        const cli = MatrixClientPeg.safeGet();
        const actions = cli.getPushActionsForEvent(this.props.mxEvent.replacingEvent() || this.props.mxEvent);
        // get the actions for the previous version of the event too if it is an edit
        const previousActions = this.props.mxEvent.replacingEvent()
            ? cli.getPushActionsForEvent(this.props.mxEvent)
            : undefined;
        if (!actions?.tweaks && !previousActions?.tweaks) {
            return false;
        }

        // don't show self-highlights from another of our clients
        if (this.props.mxEvent.getSender() === cli.credentials.userId) {
            return false;
        }

        return !!(actions?.tweaks.highlight || previousActions?.tweaks.highlight);
    }

    private readonly onSenderProfileClick = (): void => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: this.props.mxEvent.getSender()!,
            timelineRenderingType: this.context.timelineRenderingType,
        });
    };

    private readonly onPermalinkClicked = (e: MouseEvent): void => {
        // This allows the permalink to be opened in a new tab/window or copied as
        // matrix.to, but also for it to enable routing within Element when clicked.
        e.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
            metricsTrigger:
                this.context.timelineRenderingType === TimelineRenderingType.Search ? "MessageSearch" : undefined,
        });
    };

    private renderE2EPadlock(): ReactNode {
        const e2ePadlockViewState = this.e2eViewModel.getSnapshot();

        switch (e2ePadlockViewState.kind) {
            case "none":
                return null;
            case "messageShared":
                return (
                    <E2eMessageSharedIcon
                        keyForwardingUserId={e2ePadlockViewState.keyForwardingUserId}
                        roomId={e2ePadlockViewState.roomId}
                    />
                );
            case "icon":
                return <E2eStandardPadlockIcon icon={e2ePadlockViewState.icon} title={e2ePadlockViewState.title} />;
        }
    }

    private readonly onActionBarFocusChange = (actionBarFocused: boolean): void => {
        this.setState((prevState) => ({
            interaction: eventTileActionBarFocusChange(
                prevState.interaction,
                actionBarFocused,
                this.ref.current?.matches(":hover") ?? false,
            ),
        }));
    };

    private startStaleHoverCheck(): void {
        if (this.staleHoverCheckActive) return;
        document.addEventListener("mousemove", this.onDocumentMouseMove, true);
        this.staleHoverCheckActive = true;
    }

    private stopStaleHoverCheck(): void {
        if (!this.staleHoverCheckActive) return;
        document.removeEventListener("mousemove", this.onDocumentMouseMove, true);
        this.staleHoverCheckActive = false;
    }

    private readonly onDocumentMouseMove = (): void => {
        if (this.state.interaction.hover && !(this.ref.current?.matches(":hover") ?? false)) {
            this.setState((prevState) => ({
                interaction: eventTileClearHover(prevState.interaction),
            }));
        }
    };

    private readonly onMouseEnter = (): void => {
        this.setState((prevState) => ({
            interaction: eventTileMouseEnter(prevState.interaction),
        }));
    };

    private readonly onMouseLeave = (): void => {
        this.setState((prevState) => ({
            interaction: eventTileMouseLeave(prevState.interaction),
        }));
    };

    private readonly onFocusWithin = (event: FocusEvent<HTMLElement>): void => {
        // Show the action toolbar for keyboard-visible focus, with what-input as a fallback signal.
        const target = event.target as HTMLElement;
        const showActionBarFromFocus =
            target.matches(":focus-visible") || document.body.dataset["data-whatinput"] === "keyboard";
        this.setState((prevState) => ({
            interaction: eventTileFocusWithin(prevState.interaction, showActionBarFromFocus),
        }));
    };

    private readonly onBlurWithin = (event: FocusEvent<HTMLElement>): void => {
        if (event.currentTarget.contains(event.relatedTarget)) {
            return;
        }

        this.setState((prevState) => ({
            interaction: eventTileBlurWithin(prevState.interaction),
        }));
    };

    private readonly getTile: () => IEventTileType | null = () => this.tile.current;

    private readonly getReplyChain = (): ReplyChain | null => this.replyChain.current;

    private readonly getReactions = (): Relations | null => {
        return getEventTileReactionRelations({
            mxEvent: this.props.mxEvent,
            showReactions: this.props.showReactions,
            getRelationsForEvent: this.props.getRelationsForEvent,
        });
    };

    private readonly onReactionsCreated = (relationType: string, eventType: string): void => {
        if (!isEventTileReactionRelation(relationType, eventType)) {
            return;
        }
        this.setState({
            reactions: this.getReactions(),
        });
    };

    private readonly onContextMenu = (ev: React.MouseEvent): void => {
        this.showContextMenu(ev);
    };

    private readonly onTimestampContextMenu = (ev: React.MouseEvent): void => {
        this.showContextMenu(ev, this.props.permalinkCreator?.forEvent(this.props.mxEvent.getId()!));
    };

    private showContextMenu(ev: React.MouseEvent, permalink?: string): void {
        const clickTarget = ev.target as HTMLElement;

        // Try to find an anchor element
        const anchorElement = clickTarget instanceof HTMLAnchorElement ? clickTarget : clickTarget.closest("a");

        // There is no way to copy non-PNG images into clipboard, so we can't
        // have our own handling for copying images, so we leave it to the
        // Electron layer (webcontents-handler.ts)
        if (clickTarget instanceof HTMLImageElement) return;

        // Return if we're in a browser and click either an a tag, as in those cases we want to use the native browser menu
        if (!PlatformPeg.get()?.allowOverridingNativeContextMenus() && anchorElement) return;

        // We don't want to show the menu when editing a message
        if (this.props.editState) return;

        ev.preventDefault();
        ev.stopPropagation();
        this.setState((prevState) => ({
            interaction: eventTileOpenContextMenu(prevState.interaction, {
                position: {
                    left: ev.clientX,
                    top: ev.clientY,
                    bottom: ev.clientY,
                },
                link: anchorElement?.href || permalink,
            }),
        }));
    }

    private readonly onCloseMenu = (): void => {
        this.setState((prevState) => ({
            interaction: eventTileCloseContextMenu(prevState.interaction),
        }));
    };

    private readonly setQuoteExpanded = (expanded: boolean): void => {
        this.setState({
            isQuoteExpanded: expanded,
        });
    };

    /**
     * In some cases we can't use shouldHideEvent() since whether or not we hide
     * an event depends on other things that the event itself
     * @returns {boolean} true if event should be hidden
     */
    private shouldHideEvent(): boolean {
        // If the call was replaced we don't render anything since we render the other call
        if (this.props.callEventGrouper?.hangupReason === CallErrorCode.Replaced) return true;

        return false;
    }

    private renderContextMenu(): ReactNode {
        if (!this.state.interaction.contextMenu) return null;

        const tile = this.getTile();
        const replyChain = this.getReplyChain();
        const eventTileOps = tile?.getEventTileOps ? tile.getEventTileOps() : undefined;
        const collapseReplyChain = replyChain?.canCollapse() ? replyChain.collapse : undefined;

        return (
            <MessageContextMenu
                {...aboveRightOf(this.state.interaction.contextMenu.position)}
                mxEvent={this.props.mxEvent}
                permalinkCreator={this.props.permalinkCreator}
                eventTileOps={eventTileOps}
                collapseReplyChain={collapseReplyChain}
                onFinished={this.onCloseMenu}
                rightClick={true}
                reactions={this.state.reactions}
                link={this.state.interaction.contextMenu.link}
                getRelationsForEvent={this.props.getRelationsForEvent}
            />
        );
    }

    public render(): ReactNode {
        const eventType = this.props.mxEvent.getType();
        const replacingEventId = this.props.mxEvent.replacingEventId();

        const {
            hasRenderer,
            isBubbleMessage,
            isInfoMessage,
            isLeftAlignedBubbleMessage,
            noBubbleEvent,
            isSeeingThroughMessageHiddenForModeration,
            isAlignedBetweenBubbles,
        } = getEventDisplayInfo(
            MatrixClientPeg.safeGet(),
            this.props.mxEvent,
            this.context.showHiddenEvents,
            this.shouldHideEvent(),
        );
        const { isQuoteExpanded } = this.state;
        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        if (!hasRenderer) {
            const { mxEvent } = this.props;
            logger.warn(`Event type not supported: type:${eventType} isState:${mxEvent.isState()}`);
            return (
                <div className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                    <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
                </div>
            );
        }

        const isProbablyMedia = MediaEventHelper.isEligible(this.props.mxEvent);

        const isRedacted = isMessageEvent(this.props.mxEvent) && this.props.isRedacted;
        const isEncryptionFailure = this.props.mxEvent.isDecryptionFailure();
        const isEditing = !!this.props.editState;
        const hasPinnedMessageBadge = PinningUtils.isPinned(MatrixClientPeg.safeGet(), this.props.mxEvent);
        const hasReactionsRow = !isRedacted;
        const threadState = this.threadState;
        // Use `getSender()` because searched events might not have a proper `sender`.
        const isOwnEvent = this.props.mxEvent?.getSender() === MatrixClientPeg.safeGet().getUserId();

        const eventTileRenderState = EventTileViewModel.createRenderState({
            event: {
                mxEvent: this.props.mxEvent,
                eventSendStatus: this.props.eventSendStatus,
                isEditing,
                isEncryptionFailure,
                forExport: this.props.forExport,
            },
            display: {
                timelineRenderingType: this.context.timelineRenderingType,
                layout: this.props.layout,
                continuation: this.props.continuation,
                isProbablyMedia,
                isBubbleMessage,
                isLeftAlignedBubbleMessage,
                isAlignedBetweenBubbles,
                isInfoMessage,
                noBubbleEvent,
                isTwelveHour: this.props.isTwelveHour,
                isHighlighted: this.shouldHighlight(),
                isSelected: this.props.isSelectedEvent || !!this.state.interaction.contextMenu,
                isLast: this.props.last,
                isLastInSection: this.props.lastInSection,
                isContextual: this.props.contextual,
            },
            interaction: {
                hover: this.state.interaction.hover,
                showActionBarFromFocus: this.state.interaction.showActionBarFromFocus,
                focusWithin: this.state.interaction.focusWithin,
                isActionBarFocused: this.state.interaction.actionBarFocused,
                hasContextMenu: !!this.state.interaction.contextMenu,
                inhibitInteraction: this.props.inhibitInteraction,
            },
            sender: {
                hideSender: this.props.hideSender,
            },
            timestamp: {
                alwaysShowTimestamps: this.props.alwaysShowTimestamps,
                hideTimestamp: this.props.hideTimestamp,
                threadReplyEventTs: threadState.threadReplyEventTs,
            },
            footer: {
                isOwnEvent,
                hasReactionsRow,
                hasReactions: !!this.state.reactions,
                hasPinnedMessageBadge,
            },
        });
        const eventTileSnapshot = eventTileRenderState.snapshot;

        const lineClasses = eventTileRenderState.line.className;
        const tileClasses = eventTileRenderState.root.className;
        const tileAriaLive = eventTileRenderState.root.ariaLive;
        const isRenderingNotification = eventTileRenderState.root.isRenderingNotification;

        let permalink = "#";
        if (this.props.permalinkCreator) {
            permalink = this.props.permalinkCreator.forEvent(this.props.mxEvent.getId()!);
        }

        // we can't use local echoes as scroll tokens, because their event IDs change.
        // Local echos have a send "status".
        const scrollToken = eventTileRenderState.root.scrollToken;

        let avatar: JSX.Element | null = null;
        let sender: JSX.Element | null = null;
        const { avatarSize } = eventTileSnapshot.sender.profileState;

        if (this.props.mxEvent.sender && avatarSize !== null) {
            avatar = (
                <div className="mx_EventTile_avatar">
                    <MemberAvatar
                        member={eventTileSnapshot.sender.avatarMember}
                        size={avatarSize}
                        viewUserOnClick={eventTileSnapshot.sender.viewUserOnClick}
                        forceHistorical={this.props.mxEvent.getType() === EventType.RoomMember}
                    />
                </div>
            );
        }

        const senderProfileMode = eventTileSnapshot.sender.profileMode;
        if (senderProfileMode === "clickable") {
            sender = <SenderProfile onClick={this.onSenderProfileClick} mxEvent={this.props.mxEvent} />;
        } else if (senderProfileMode === "tooltip") {
            sender = <SenderProfile mxEvent={this.props.mxEvent} withTooltip />;
        } else if (senderProfileMode === "default") {
            sender = <SenderProfile mxEvent={this.props.mxEvent} />;
        }

        const actionBar = eventTileSnapshot.actionBar.show ? (
            <ActionBarWrapper
                mxEvent={this.props.mxEvent}
                reactions={this.state.reactions}
                permalinkCreator={this.props.permalinkCreator}
                getTile={this.getTile}
                getReplyChain={this.getReplyChain}
                onFocusChange={this.onActionBarFocusChange}
                isQuoteExpanded={isQuoteExpanded}
                toggleThreadExpanded={() => this.setQuoteExpanded(!isQuoteExpanded)}
                getRelationsForEvent={this.props.getRelationsForEvent}
            />
        ) : undefined;

        // Thread panel shows the timestamp of the last reply in that thread
        const ts = eventTileRenderState.timestamp.value;

        const messageTimestampProps: MessageTimestampViewModelProps = {
            showRelative: this.context.timelineRenderingType === TimelineRenderingType.ThreadsList,
            showTwelveHour: this.props.isTwelveHour,
            ts,
            receivedTs: getLateEventInfo(this.props.mxEvent)?.received_ts,
        };
        const messageTimestamp = <MessageTimestampWrapper {...messageTimestampProps} />;
        const linkedMessageTimestamp = (
            <MessageTimestampWrapper
                {...messageTimestampProps}
                href={permalink}
                onClick={this.onPermalinkClicked}
                onContextMenu={this.onTimestampContextMenu}
            />
        );

        const { useIRCLayout, showRealTimestamp, showLinkedTimestamp } = eventTileRenderState.timestamp.displayState;
        // Used to simplify the UI layout where necessary by not conditionally rendering an element at the start
        const dummyTimestamp = useIRCLayout ? <span className="mx_MessageTimestamp" /> : null;
        const timestamp = showRealTimestamp ? messageTimestamp : dummyTimestamp;
        const linkedTimestamp = showLinkedTimestamp ? linkedMessageTimestamp : dummyTimestamp;

        let pinnedMessageBadge: JSX.Element | undefined;
        if (hasPinnedMessageBadge) {
            pinnedMessageBadge = <PinnedMessageBadge aria-describedby={this.id} tabIndex={0} />;
        }

        let reactionsRow: JSX.Element | undefined;
        if (hasReactionsRow) {
            reactionsRow = (
                <ReactionsRowWrapper
                    mxEvent={this.props.mxEvent}
                    reactions={this.state.reactions}
                    key="mx_EventTile_reactionsRow"
                />
            );
        }

        const groupTimestamp = !useIRCLayout ? linkedTimestamp : null;
        const ircTimestamp = useIRCLayout ? linkedTimestamp : null;
        const groupPadlock = !useIRCLayout && !isBubbleMessage && this.renderE2EPadlock();
        const ircPadlock = useIRCLayout && !isBubbleMessage && this.renderE2EPadlock();

        const receiptState = this.receiptState;
        let msgOption: JSX.Element | undefined;
        if (receiptState.shouldShowSentReceipt || receiptState.shouldShowSendingReceipt) {
            msgOption = <SentReceipt messageState={this.props.eventSendStatus} />;
        } else if (this.props.showReadReceipts) {
            msgOption = (
                <ReadReceiptGroup
                    readReceipts={this.props.readReceipts ?? []}
                    readReceiptMap={this.props.readReceiptMap ?? {}}
                    checkUnmounting={this.props.checkUnmounting}
                    suppressAnimation={this.suppressReadReceiptAnimation}
                    isTwelveHour={this.props.isTwelveHour}
                />
            );
        }

        const replyChainState = getEventTileReplyChainState({
            mxEvent: this.props.mxEvent,
            hasRenderer: haveRendererForEvent(
                this.props.mxEvent,
                MatrixClientPeg.safeGet(),
                this.context.showHiddenEvents,
            ),
        });
        let replyChain: JSX.Element | undefined;
        if (replyChainState.shouldShowReplyChain) {
            replyChain = (
                <ReplyChain
                    parentEv={this.props.mxEvent}
                    ref={this.replyChain}
                    forExport={this.props.forExport}
                    permalinkCreator={this.props.permalinkCreator}
                    layout={this.props.layout}
                    alwaysShowTimestamps={eventTileSnapshot.replyChain.alwaysShowTimestamps}
                    isQuoteExpanded={isQuoteExpanded}
                    setQuoteExpanded={this.setQuoteExpanded}
                    getRelationsForEvent={this.props.getRelationsForEvent}
                />
            );
        }

        const { hasFooter, showMainPinnedMessageBadge, showBubblePinnedMessageBadge } = eventTileSnapshot.footer;

        switch (this.context.timelineRenderingType) {
            case TimelineRenderingType.Thread: {
                return React.createElement(
                    this.props.as || "li",
                    {
                        "ref": this.ref,
                        "className": tileClasses,
                        "aria-live": tileAriaLive,
                        "aria-atomic": true,
                        "data-scroll-tokens": scrollToken,
                        "data-has-reply": !!replyChain,
                        "data-layout": this.props.layout,
                        "data-self": isOwnEvent,
                        "data-event-id": this.props.mxEvent.getId(),
                        "onMouseEnter": this.onMouseEnter,
                        "onMouseLeave": this.onMouseLeave,
                        "onFocus": this.onFocusWithin,
                        "onBlur": this.onBlurWithin,
                    },
                    [
                        <div className="mx_EventTile_senderDetails" key="mx_EventTile_senderDetails">
                            {avatar}
                            {sender}
                        </div>,
                        <div
                            id={this.id}
                            className={lineClasses}
                            key="mx_EventTile_line"
                            onContextMenu={this.onContextMenu}
                        >
                            {this.renderContextMenu()}
                            {replyChain}
                            {renderTile(TimelineRenderingType.Thread, {
                                ...this.props,

                                // overrides
                                ref: this.tile,
                                replacingEventId,
                                isSeeingThroughMessageHiddenForModeration,

                                // appease TS
                                highlights: this.props.highlights,
                                highlightLink: this.props.highlightLink,
                                permalinkCreator: this.props.permalinkCreator!,
                                showHiddenEvents: this.context.showHiddenEvents,
                            })}
                            {actionBar}
                            {linkedTimestamp}
                            {msgOption}
                        </div>,
                        hasFooter && (
                            <div className="mx_EventTile_footer" key="mx_EventTile_footer">
                                {showMainPinnedMessageBadge && pinnedMessageBadge}
                                {reactionsRow}
                                {showBubblePinnedMessageBadge && pinnedMessageBadge}
                            </div>
                        ),
                    ],
                );
            }
            case TimelineRenderingType.Notification:
            case TimelineRenderingType.ThreadsList: {
                const room = MatrixClientPeg.safeGet().getRoom(this.props.mxEvent.getRoomId());
                // tab-index=-1 to allow it to be focusable but do not add tab stop for it, primarily for screen readers
                return React.createElement(
                    this.props.as || "li",
                    {
                        "ref": this.ref,
                        "className": tileClasses,
                        "tabIndex": -1,
                        "aria-live": tileAriaLive,
                        "aria-atomic": "true",
                        "data-scroll-tokens": scrollToken,
                        "data-layout": this.props.layout,
                        "data-shape": this.context.timelineRenderingType,
                        "data-self": isOwnEvent,
                        "data-has-reply": !!replyChain,
                        "onMouseEnter": this.onMouseEnter,
                        "onMouseLeave": this.onMouseLeave,
                        "onFocus": this.onFocusWithin,
                        "onBlur": this.onBlurWithin,
                        "onClick": (ev: MouseEvent) => {
                            const target = ev.currentTarget as HTMLElement;
                            let index = -1;
                            if (target.parentElement) index = Array.from(target.parentElement.children).indexOf(target);
                            switch (this.context.timelineRenderingType) {
                                case TimelineRenderingType.Notification:
                                    this.onViewInRoomClick(null);
                                    break;
                                case TimelineRenderingType.ThreadsList:
                                    dis.dispatch<ShowThreadPayload>({
                                        action: Action.ShowThread,
                                        rootEvent: this.props.mxEvent,
                                        push: true,
                                    });
                                    PosthogTrackers.trackInteraction("WebThreadsPanelThreadItem", ev, index ?? -1);
                                    break;
                            }
                        },
                    },
                    <>
                        <div className="mx_EventTile_details">
                            {sender}
                            {isRenderingNotification && room ? (
                                <span className="mx_EventTile_truncated">
                                    {" "}
                                    {_t(
                                        "timeline|in_room_name",
                                        { room: room.name },
                                        { strong: (sub) => <strong>{sub}</strong> },
                                    )}
                                </span>
                            ) : (
                                ""
                            )}
                            {timestamp}
                            <UnreadNotificationBadge
                                room={room || undefined}
                                threadId={this.props.mxEvent.getId()}
                                forceDot={true}
                            />
                        </div>
                        {isRenderingNotification && room ? (
                            <div className="mx_EventTile_avatar">
                                <RoomAvatar room={room} size="28px" />
                            </div>
                        ) : (
                            avatar
                        )}
                        <div className={lineClasses} key="mx_EventTile_line">
                            <div className="mx_EventTile_body">
                                {this.props.mxEvent.isRedacted() ? (
                                    <RedactedBodyFactory mxEvent={this.props.mxEvent} />
                                ) : this.props.mxEvent.isDecryptionFailure() ? (
                                    <DecryptionFailureBodyFactory mxEvent={this.props.mxEvent} />
                                ) : (
                                    <EventPreview mxEvent={this.props.mxEvent} />
                                )}
                            </div>
                            {this.renderThreadPanelSummary(threadState)}
                        </div>
                        {this.context.timelineRenderingType === TimelineRenderingType.ThreadsList && (
                            <ThreadListActionBarWrapper
                                onViewInRoomClick={this.onViewInRoomClick}
                                onCopyLinkClick={this.onCopyLinkToThreadClick}
                            />
                        )}

                        {msgOption}
                    </>,
                );
            }
            case TimelineRenderingType.File: {
                return React.createElement(
                    this.props.as || "li",
                    {
                        "className": tileClasses,
                        "aria-live": tileAriaLive,
                        "aria-atomic": true,
                        "data-scroll-tokens": scrollToken,
                    },
                    [
                        <a
                            className="mx_EventTile_senderDetailsLink"
                            key="mx_EventTile_senderDetailsLink"
                            href={permalink}
                            onClick={this.onPermalinkClicked}
                        >
                            <div className="mx_EventTile_senderDetails" onContextMenu={this.onTimestampContextMenu}>
                                {avatar}
                                {sender}
                                {timestamp}
                            </div>
                        </a>,
                        <div className={lineClasses} key="mx_EventTile_line" onContextMenu={this.onContextMenu}>
                            {this.renderContextMenu()}
                            {renderTile(TimelineRenderingType.File, {
                                ...this.props,

                                // overrides
                                ref: this.tile,
                                isSeeingThroughMessageHiddenForModeration,

                                // appease TS
                                highlights: this.props.highlights,
                                highlightLink: this.props.highlightLink,
                                permalinkCreator: this.props.permalinkCreator,
                                showHiddenEvents: this.context.showHiddenEvents,
                            })}
                        </div>,
                    ],
                );
            }

            default: {
                // Pinned, Room, Search
                // tab-index=-1 to allow it to be focusable but do not add tab stop for it, primarily for screen readers
                return React.createElement(
                    this.props.as || "li",
                    {
                        "ref": this.ref,
                        "className": tileClasses,
                        "tabIndex": -1,
                        "aria-live": tileAriaLive,
                        "aria-atomic": "true",
                        "data-scroll-tokens": scrollToken,
                        "data-layout": this.props.layout,
                        "data-self": isOwnEvent,
                        "data-event-id": this.props.mxEvent.getId(),
                        "data-has-reply": !!replyChain,
                        "onMouseEnter": this.onMouseEnter,
                        "onMouseLeave": this.onMouseLeave,
                        "onFocus": this.onFocusWithin,
                        "onBlur": this.onBlurWithin,
                    },
                    <>
                        {ircTimestamp}
                        {sender}
                        {ircPadlock}
                        {avatar}
                        <div
                            id={this.id}
                            className={lineClasses}
                            key="mx_EventTile_line"
                            onContextMenu={this.onContextMenu}
                        >
                            {this.renderContextMenu()}
                            {groupTimestamp}
                            {groupPadlock}
                            {replyChain}
                            {renderTile(this.context.timelineRenderingType, {
                                ...this.props,

                                // overrides
                                ref: this.tile,
                                isSeeingThroughMessageHiddenForModeration,

                                // appease TS
                                highlights: this.props.highlights,
                                highlightLink: this.props.highlightLink,
                                permalinkCreator: this.props.permalinkCreator,
                                showHiddenEvents: this.context.showHiddenEvents,
                            })}
                            {actionBar}
                            {this.props.layout === Layout.IRC && (
                                <>
                                    {hasFooter && (
                                        <div className="mx_EventTile_footer">
                                            {pinnedMessageBadge}
                                            {reactionsRow}
                                        </div>
                                    )}
                                    {this.renderThreadInfo(threadState)}
                                </>
                            )}
                        </div>
                        {this.props.layout !== Layout.IRC && (
                            <>
                                {hasFooter && (
                                    <div className="mx_EventTile_footer">
                                        {showMainPinnedMessageBadge && pinnedMessageBadge}
                                        {reactionsRow}
                                        {showBubblePinnedMessageBadge && pinnedMessageBadge}
                                    </div>
                                )}
                                {this.renderThreadInfo(threadState)}
                            </>
                        )}
                        {msgOption}
                    </>,
                );
            }
        }
    }
}

/**
 * Props for the event-tile fallback rendered after the tile error boundary catches a render failure.
 */
interface EventTileErrorFallbackProps {
    error: Error;
    mxEvent: MatrixEvent;
}

function EventTileErrorFallback({ error, mxEvent }: Readonly<EventTileErrorFallbackProps>): JSX.Element {
    const developerMode = useSettingValue("developerMode");
    const vm = useCreateAutoDisposedViewModel(() => new TileErrorViewModel({ error, mxEvent, developerMode }));

    useEffect(() => {
        vm.setError(error);
    }, [error, vm]);

    useEffect(() => {
        vm.setDeveloperMode(developerMode);
    }, [developerMode, vm]);

    return <TileErrorView vm={vm} className="mx_EventTile mx_EventTile_info mx_EventTile_content" />;
}

interface EventTileErrorBoundaryProps {
    children: ReactNode;
    mxEvent: MatrixEvent;
}

interface EventTileErrorBoundaryState {
    error?: Error;
}

class EventTileErrorBoundary extends React.Component<EventTileErrorBoundaryProps, EventTileErrorBoundaryState> {
    public constructor(props: EventTileErrorBoundaryProps) {
        super(props);
        this.state = {};
    }

    public static getDerivedStateFromError(error: Error): Partial<EventTileErrorBoundaryState> {
        return { error };
    }

    public render(): ReactNode {
        if (this.state.error) {
            return <EventTileErrorFallback error={this.state.error} mxEvent={this.props.mxEvent} />;
        }

        return this.props.children;
    }
}

// Wrap all event tiles with the tile error boundary so that any throws even during construction are captured
const SafeEventTile = (props: EventTileProps): JSX.Element => {
    return (
        <EventTileErrorBoundary mxEvent={props.mxEvent}>
            <UnwrappedEventTile {...props} />
        </EventTileErrorBoundary>
    );
};
export default SafeEventTile;

interface ISentReceiptProps {
    messageState: EventStatus | undefined;
}

function SentReceipt({ messageState }: ISentReceiptProps): JSX.Element {
    const isSent = !messageState || messageState === "sent";
    const isFailed = messageState === "not_sent";

    let icon: JSX.Element | undefined;
    let label: string | undefined;
    if (messageState === "encrypting") {
        icon = <CircleIcon />;
        label = _t("timeline|send_state_encrypting");
    } else if (isSent) {
        icon = <CheckCircleIcon />;
        label = _t("timeline|send_state_sent");
    } else if (isFailed) {
        icon = <NotificationBadge notification={StaticNotificationState.RED_EXCLAMATION} />;
        label = _t("timeline|send_state_failed");
    } else {
        icon = <CircleIcon />;
        label = _t("timeline|send_state_sending");
    }

    return (
        <div className="mx_EventTile_msgOption">
            <div className="mx_ReadReceiptGroup">
                <Tooltip label={label} placement="top-end">
                    <div className="mx_ReadReceiptGroup_button" role="status">
                        <span className="mx_ReadReceiptGroup_container">{icon}</span>
                    </div>
                </Tooltip>
            </div>
        </div>
    );
}

/**
 * Wraps MessageTimestampView with a view model synced to the provided props.
 * This wrapper can be removed after EventTile has been changed to a function component.
 */
function MessageTimestampWrapper(props: MessageTimestampViewModelProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new MessageTimestampViewModel(props));
    useEffect(() => {
        vm.setTimestamp(props.ts);
        vm.setReceivedTimestamp(props.receivedTs);
        vm.setDisplayOptions({
            showTwelveHour: props.showTwelveHour,
            showRelative: props.showRelative,
        });
        vm.setHref(props.href);
        vm.setHandlers({ onClick: props.onClick, onContextMenu: props.onContextMenu });
    }, [vm, props]);

    return (
        <>
            {/* Render icon as described in, https://github.com/matrix-org/matrix-react-sdk/pull/11760 */}
            {props.receivedTs ? (
                <LateIcon className="mx_MessageTimestamp_lateIcon" width="16" height="16" />
            ) : undefined}
            <MessageTimestampView vm={vm} className="mx_MessageTimestamp" />
        </>
    );
}

interface ReactionsRowButtonItemProps {
    mxEvent: MatrixEvent;
    content: string;
    count: number;
    reactionEvents: MatrixEvent[];
    myReactionEvent?: MatrixEvent;
    disabled?: boolean;
    customReactionImagesEnabled?: boolean;
}

function ReactionsRowButtonItem(props: Readonly<ReactionsRowButtonItemProps>): JSX.Element {
    const client = useMatrixClientContext();

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ReactionsRowButtonViewModel({
                client,
                mxEvent: props.mxEvent,
                content: props.content,
                count: props.count,
                reactionEvents: props.reactionEvents,
                myReactionEvent: props.myReactionEvent,
                disabled: props.disabled,
                customReactionImagesEnabled: props.customReactionImagesEnabled,
            }),
    );

    useEffect(() => {
        vm.setReactionData(props.content, props.reactionEvents, props.customReactionImagesEnabled);
    }, [props.content, props.reactionEvents, props.customReactionImagesEnabled, vm]);

    useEffect(() => {
        vm.setCount(props.count);
    }, [props.count, vm]);

    useEffect(() => {
        vm.setMyReactionEvent(props.myReactionEvent);
    }, [props.myReactionEvent, vm]);

    useEffect(() => {
        vm.setDisabled(props.disabled);
    }, [props.disabled, vm]);

    return <ReactionsRowButtonView vm={vm} />;
}

interface ReactionGroup {
    content: string;
    events: MatrixEvent[];
}

const getReactionGroups = (reactions?: Relations | null): ReactionGroup[] =>
    reactions
        ?.getSortedAnnotationsByKey()
        ?.map(([content, events]) => ({
            content,
            events: [...events],
        }))
        .filter(({ events }) => events.length > 0) ?? [];

const getMyReactions = (reactions: Relations | null | undefined, userId?: string): MatrixEvent[] | null => {
    if (!reactions || !userId) {
        return null;
    }

    const myReactions = reactions.getAnnotationsBySender()?.[userId];
    if (!myReactions) {
        return null;
    }

    return [...myReactions.values()];
};

interface ReactionsRowWrapperProps {
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
}

function ReactionsRowWrapper({ mxEvent, reactions }: Readonly<ReactionsRowWrapperProps>): JSX.Element | null {
    const roomContext = useContext(RoomContext);
    const userId = roomContext.room?.client.getUserId() ?? undefined;
    const [reactionGroups, setReactionGroups] = useState<ReactionGroup[]>(() => getReactionGroups(reactions));
    const [myReactions, setMyReactions] = useState<MatrixEvent[] | null>(() => getMyReactions(reactions, userId));
    const [menuDisplayed, setMenuDisplayed] = useState(false);
    const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ReactionsRowViewModel({
                isActionable: isContentActionable(mxEvent),
                reactionGroupCount: reactionGroups.length,
                canReact: roomContext.canReact,
                addReactionButtonActive: false,
            }),
    );

    const openReactionMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>): void => {
        setMenuAnchorRect(event.currentTarget.getBoundingClientRect());
        setMenuDisplayed(true);
    }, []);

    const closeReactionMenu = useCallback((): void => {
        setMenuDisplayed(false);
    }, []);

    const updateReactionsState = useCallback((): void => {
        const nextReactionGroups = getReactionGroups(reactions);
        setReactionGroups(nextReactionGroups);
        setMyReactions(getMyReactions(reactions, userId));
        vm.setReactionGroupCount(nextReactionGroups.length);
    }, [reactions, userId, vm]);

    useEffect(() => {
        vm.setActionable(isContentActionable(mxEvent));
    }, [mxEvent, vm]);

    useEffect(() => {
        vm.setCanReact(roomContext.canReact);
        if (!roomContext.canReact && menuDisplayed) {
            setMenuDisplayed(false);
        }
    }, [roomContext.canReact, menuDisplayed, vm]);

    useEffect(() => {
        vm.setAddReactionHandlers({
            onAddReactionClick: openReactionMenu,
            onAddReactionContextMenu: openReactionMenu,
        });
    }, [openReactionMenu, vm]);

    useEffect(() => {
        vm.setAddReactionButtonActive(menuDisplayed);
    }, [menuDisplayed, vm]);

    useEffect(() => {
        updateReactionsState();
    }, [updateReactionsState]);

    useEffect(() => {
        if (!reactions) return;

        reactions.on(RelationsEvent.Add, updateReactionsState);
        reactions.on(RelationsEvent.Remove, updateReactionsState);
        reactions.on(RelationsEvent.Redaction, updateReactionsState);

        return () => {
            reactions.off(RelationsEvent.Add, updateReactionsState);
            reactions.off(RelationsEvent.Remove, updateReactionsState);
            reactions.off(RelationsEvent.Redaction, updateReactionsState);
        };
    }, [reactions, updateReactionsState]);

    useEffect(() => {
        const onDecrypted = (): void => {
            vm.setActionable(isContentActionable(mxEvent));
        };

        if (mxEvent.isBeingDecrypted() || mxEvent.shouldAttemptDecryption()) {
            mxEvent.once(MatrixEventEvent.Decrypted, onDecrypted);
        }

        return () => {
            mxEvent.off(MatrixEventEvent.Decrypted, onDecrypted);
        };
    }, [mxEvent, vm]);

    const snapshot = useViewModel(vm);
    const customReactionImagesEnabled = SettingsStore.getValue("feature_render_reaction_images");
    const items = useMemo((): JSX.Element[] | undefined => {
        const mappedItems = reactionGroups.map(({ content, events }) => {
            // Deduplicate reaction events by sender per Matrix spec.
            const deduplicatedEvents = uniqBy(events, (event: MatrixEvent) => event.getSender());
            const myReactionEvent = myReactions?.find((reactionEvent) => {
                if (reactionEvent.isRedacted()) {
                    return false;
                }
                return reactionEvent.getRelation()?.key === content;
            });

            return (
                <ReactionsRowButtonItem
                    key={content}
                    content={content}
                    count={deduplicatedEvents.length}
                    mxEvent={mxEvent}
                    reactionEvents={deduplicatedEvents}
                    myReactionEvent={myReactionEvent}
                    customReactionImagesEnabled={customReactionImagesEnabled}
                    disabled={
                        !roomContext.canReact ||
                        (myReactionEvent && !myReactionEvent.isRedacted() && !roomContext.canSelfRedact)
                    }
                />
            );
        });

        if (!mappedItems.length) {
            return undefined;
        }

        return snapshot.showAllButtonVisible ? mappedItems.slice(0, MAX_ITEMS_WHEN_LIMITED) : mappedItems;
    }, [
        reactionGroups,
        myReactions,
        mxEvent,
        customReactionImagesEnabled,
        roomContext.canReact,
        roomContext.canSelfRedact,
        snapshot.showAllButtonVisible,
    ]);

    if (!snapshot.isVisible || !items?.length) {
        return null;
    }

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed && menuAnchorRect && reactions && roomContext.canReact) {
        contextMenu = (
            <ContextMenu {...aboveLeftOf(menuAnchorRect)} onFinished={closeReactionMenu} managed={false} focusLock>
                <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeReactionMenu} />
            </ContextMenu>
        );
    }

    return (
        <>
            <ReactionsRowView vm={vm} className="mx_ReactionsRow">
                {items}
            </ReactionsRowView>
            {contextMenu}
        </>
    );
}

interface ActionBarWrapperProps {
    mxEvent: MatrixEvent;
    reactions?: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getTile: () => IEventTileType | null;
    getReplyChain: () => ReplyChain | null;
    onFocusChange?: (focused: boolean) => void;
    isQuoteExpanded?: boolean;
    toggleThreadExpanded: () => void;
    getRelationsForEvent?: GetRelationsForEvent;
}

interface ThreadListActionBarWrapperProps {
    onViewInRoomClick: (anchor: HTMLElement | null) => void;
    onCopyLinkClick: (anchor: HTMLElement | null) => void | Promise<void>;
}

function ThreadListActionBarWrapper({
    onViewInRoomClick,
    onCopyLinkClick,
}: Readonly<ThreadListActionBarWrapperProps>): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new ThreadListActionBarViewModel({
                onViewInRoomClick,
                onCopyLinkClick,
            }),
    );

    useEffect(() => {
        vm.setProps({
            onViewInRoomClick,
            onCopyLinkClick,
        });
    }, [vm, onViewInRoomClick, onCopyLinkClick]);

    return <ActionBarView vm={vm} className="mx_ThreadActionBar" />;
}

function ActionBarWrapper({
    mxEvent,
    reactions,
    permalinkCreator,
    getTile,
    getReplyChain,
    onFocusChange,
    isQuoteExpanded,
    toggleThreadExpanded,
    getRelationsForEvent,
}: Readonly<ActionBarWrapperProps>): JSX.Element {
    const roomContext = useContext(RoomContext);
    const { isCard } = useContext(CardContext);
    const [optionsMenuAnchorRect, setOptionsMenuAnchorRect] = useState<DOMRect | null>(null);
    const [reactionsMenuAnchorRect, setReactionsMenuAnchorRect] = useState<DOMRect | null>(null);
    const isSearch = Boolean(roomContext.search);
    const handleOptionsClick = useCallback((anchor: HTMLElement | null): void => {
        setOptionsMenuAnchorRect(anchor?.getBoundingClientRect() ?? null);
    }, []);
    const handleReactionsClick = useCallback((anchor: HTMLElement | null): void => {
        setReactionsMenuAnchorRect(anchor?.getBoundingClientRect() ?? null);
    }, []);
    const vm = useCreateAutoDisposedViewModel(
        () =>
            new EventTileActionBarViewModel({
                mxEvent,
                timelineRenderingType: roomContext.timelineRenderingType,
                canSendMessages: roomContext.canSendMessages,
                canReact: roomContext.canReact,
                isSearch,
                isCard,
                isQuoteExpanded,
                onToggleThreadExpanded: toggleThreadExpanded,
                onOptionsClick: handleOptionsClick,
                onReactionsClick: handleReactionsClick,
                getRelationsForEvent,
            }),
    );

    useEffect(() => {
        vm.setProps({
            mxEvent,
            timelineRenderingType: roomContext.timelineRenderingType,
            canSendMessages: roomContext.canSendMessages,
            canReact: roomContext.canReact,
            isSearch,
            isCard,
            isQuoteExpanded,
            getRelationsForEvent,
            onToggleThreadExpanded: toggleThreadExpanded,
            onOptionsClick: handleOptionsClick,
            onReactionsClick: handleReactionsClick,
        });
    }, [
        vm,
        mxEvent,
        roomContext.timelineRenderingType,
        roomContext.canSendMessages,
        roomContext.canReact,
        isSearch,
        isCard,
        isQuoteExpanded,
        getRelationsForEvent,
        handleOptionsClick,
        handleReactionsClick,
        toggleThreadExpanded,
    ]);

    useEffect(() => {
        onFocusChange?.(Boolean(optionsMenuAnchorRect || reactionsMenuAnchorRect));
    }, [onFocusChange, optionsMenuAnchorRect, reactionsMenuAnchorRect]);

    useEffect(() => {
        setOptionsMenuAnchorRect(null);
        setReactionsMenuAnchorRect(null);
    }, [mxEvent]);

    const closeOptionsMenu = useCallback((): void => {
        setOptionsMenuAnchorRect(null);
    }, []);

    const closeReactionsMenu = useCallback((): void => {
        setReactionsMenuAnchorRect(null);
    }, []);

    const tile = getTile();
    const replyChain = getReplyChain();
    const eventTileOps = tile?.getEventTileOps ? tile.getEventTileOps() : undefined;
    const collapseReplyChain = replyChain?.canCollapse() ? replyChain.collapse : undefined;

    return (
        <>
            <ActionBarView vm={vm} className="mx_MessageActionBar" />
            {optionsMenuAnchorRect ? (
                <MessageContextMenu
                    {...aboveLeftOf(optionsMenuAnchorRect)}
                    mxEvent={mxEvent}
                    permalinkCreator={permalinkCreator}
                    eventTileOps={eventTileOps}
                    collapseReplyChain={collapseReplyChain}
                    onFinished={closeOptionsMenu}
                    getRelationsForEvent={getRelationsForEvent}
                />
            ) : null}
            {reactionsMenuAnchorRect ? (
                <ContextMenu
                    {...aboveLeftOf(reactionsMenuAnchorRect)}
                    onFinished={closeReactionsMenu}
                    managed={false}
                    focusLock
                >
                    <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeReactionsMenu} />
                </ContextMenu>
            ) : null}
        </>
    );
}
