/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    createRef,
    useEffect,
    type JSX,
    type Ref,
    type FocusEvent,
    type MouseEvent,
    type ReactNode,
} from "react";
import {
    EventStatus,
    type MatrixEvent,
    MatrixEventEvent,
    type Relations,
    type Room,
    RoomEvent,
    type RoomMember,
    type Thread,
    ThreadEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { uniqueId } from "lodash";
import {
    EventTileView,
    NotificationBadgeView,
    useCreateAutoDisposedViewModel,
    TileErrorView,
    type EventTileRenderingMode,
} from "@element-hq/web-shared-components";

import ReplyChain from "../elements/ReplyChain";
import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { Layout } from "../../../settings/enums/Layout";
import SettingsStore from "../../../settings/SettingsStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import RoomAvatar from "../avatars/RoomAvatar";
import MessageContextMenu from "../context_menus/MessageContextMenu";
import { aboveRightOf } from "../../structures/ContextMenu";
import { objectHasDiff } from "../../../utils/objects";
import type EditorStateTransfer from "../../../utils/EditorStateTransfer";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";
import { type ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../dispatcher/actions";
import PlatformPeg from "../../../PlatformPeg";
import { type IReadReceiptPosition } from "./ReadReceiptMarker";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { copyPlaintext } from "../../../utils/strings";
import { DecryptionFailureTracker } from "../../../DecryptionFailureTracker";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import PosthogTrackers from "../../../PosthogTrackers";
import { isMessageEvent, renderTile, type EventTileTypeProps } from "../../../events/EventTileFactory";
import { type ShowThreadPayload } from "../../../dispatcher/payloads/ShowThreadPayload";
import { getLateEventInfo } from "../../structures/grouper/LateEventGrouper";
import PinningUtils from "../../../utils/PinningUtils";
import { ActionBarAdapter } from "./EventTile/ActionBarAdapter";
import { E2eStandardPadlockIcon } from "./EventTile/E2eStandardPadlockIcon";
import { E2eMessageSharedIconAdapter } from "./EventTile/E2eMessageSharedIconAdapter";
import { EventTileAvatarAdapter } from "./EventTile/EventTileAvatarAdapter";
import { ReceiptAdapter } from "./EventTile/ReceiptAdapter";
import { EventTileSenderAdapter } from "./EventTile/EventTileSenderAdapter";
import { ThreadListActionBarAdapter } from "./EventTile/ThreadListActionBarAdapter";
import { EventTileFooter } from "./EventTile/EventTileFooter";
import { EventTilePreviewBody } from "./EventTile/EventTilePreviewBody";
import { EventTileThreadInfo, EventTileThreadPanelSummary } from "./EventTile/EventTileThreadInfo";
import { MessageTimestampAdapter } from "./EventTile/MessageTimestampAdapter";
import {
    EventTileViewModel,
    type EventTileViewModelProps,
    type EventTileViewModelDependencies,
} from "../../../viewmodels/room/timeline/event-tile/EventTileViewModel";
import {
    getEventTileReceiptState,
    type EventTileReceiptState,
} from "../../../viewmodels/room/timeline/event-tile/EventTileReceiptState";
import {
    getEventTileThread,
    getEventTileThreadState,
    type EventTileThreadState,
} from "../../../viewmodels/room/timeline/event-tile/EventTileThreadState";
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
import { type MessageTimestampViewModelProps } from "../../../viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel.ts";
import {
    getEventTileReactionRelations,
    isEventTileReactionRelation,
    type GetRelationsForEvent,
} from "../../../viewmodels/room/timeline/event-tile/reactions/EventTileReactionState";
import { TileErrorViewModel } from "../../../viewmodels/message-body/TileErrorViewModel";
import { useSettingValue } from "../../../hooks/useSettings";
import { resolveRoomMemberProfile, roomMemberToMemberInfo } from "../../../hooks/room/useRoomMemberProfile";
import { EventTileE2eViewModel } from "../../../viewmodels/room/timeline/event-tile/EventTileE2eViewModel";
import { shouldHighlightEventTile } from "../../../viewmodels/room/timeline/event-tile/EventTileHighlightState";
import { shouldHideEventTile } from "../../../viewmodels/room/timeline/event-tile/EventTileVisibilityState";
import { UnreadNotificationBadgeViewModel } from "../../../viewmodels/room/notification-badge/UnreadNotificationBadgeViewModel";

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

/** Read receipt entry rendered beside an EventTile. */
export interface IReadReceiptProps {
    /** User ID that owns the receipt. */
    userId: string;
    /** Room member profile for the receipt user, if available. */
    roomMember: RoomMember | null;
    /** Receipt timestamp in milliseconds. */
    ts: number;
}

/** Operations exposed by specialized event tile body renderers. */
export interface IEventTileOps {
    /** Whether the body renderer is currently hiding a widget. */
    isWidgetHidden(): boolean;
    /** Reveal a hidden widget in the body renderer. */
    unhideWidget(): void;
}

/** Ref surface exposed by concrete event tile body components. */
export interface IEventTileType extends React.Component<HTMLDivElement> {
    /** Optional body-specific operations for context menu actions. */
    getEventTileOps?(): IEventTileOps;
    /** Media helper owned by the body renderer, when the event has media. */
    getMediaHelper(): MediaEventHelper | undefined;
}

/** Props used to render an event in a room timeline surface. */
export interface EventTileProps {
    /** Matrix event to render. */
    mxEvent: MatrixEvent;

    /**
     * Whether the event is redacted.
     * This mirrors `mxEvent.isRedacted()` because `mxEvent` may retain object identity across updates.
     */
    isRedacted?: boolean;

    /** Whether this event continues the previous sender block. */
    continuation?: boolean;

    /** Whether this is the last event in the timeline. */
    last?: boolean;

    /** Whether this is the last event in a timeline section. */
    lastInSection?: boolean;

    /** Whether this is the most recent successfully sent event. */
    lastSuccessful?: boolean;

    /** Whether this tile is rendered with search-context styling. */
    contextual?: boolean;

    /** Words to highlight in the event body, ordered longest first. */
    highlights?: string[];

    /** Link URL used for highlighted terms. */
    highlightLink?: string;

    /** Whether URL previews should be shown for this event. */
    showUrlPreview?: boolean;

    /** Whether this is the currently selected event. */
    isSelectedEvent?: boolean;

    /** Resize observer used by the parent timeline, if any. */
    resizeObserver?: ResizeObserver;

    /** Read receipts to show for this event. */
    readReceipts?: IReadReceiptProps[];

    /** Opaque read receipt animation state keyed by user ID. */
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };

    /** Returns whether the parent panel is unmounting and tile work should be skipped. */
    checkUnmounting?: () => boolean;

    /** Denormalized `mxEvent.status` so status changes can trigger tile updates. */
    eventSendStatus?: EventStatus;

    /** Whether this tile is being rendered for export. */
    forExport?: boolean;

    /** Whether timestamps should use twelve-hour formatting. */
    isTwelveHour?: boolean;

    /** Helper used to access relations for this event. */
    getRelationsForEvent?: GetRelationsForEvent;

    /** Whether reactions should be shown for this event. */
    showReactions?: boolean;

    /** Timeline layout used by this tile. */
    layout?: Layout;

    /** The shape used by this tile. */
    shape?: EventTileRenderingMode;

    /** Whether read receipts should be shown for this event. */
    showReadReceipts?: boolean;

    /** Editor state used while editing and across remote echo remounts. */
    editState?: EditorStateTransfer;

    /** Event ID replacing this event's content, if any. */
    replacingEventId?: string;

    /** Helper used to build room and event permalinks. */
    permalinkCreator?: RoomPermalinkCreator;

    /** Legacy call event grouping state for this event. */
    callEventGrouper?: LegacyCallEventGrouper;

    /** Element type used for the root node. */
    as?: React.ElementType;

    /** Whether timestamps should always be visible. */
    alwaysShowTimestamps?: boolean;

    /** Whether sender identity should be hidden. */
    hideSender?: boolean;

    /** Whether thread information should be shown. */
    showThreadInfo?: boolean;

    /** Whether the current user can see a message hidden from other users for moderation. */
    isSeeingThroughMessageHiddenForModeration?: boolean;

    /** Whether sender profile rendering should use the event-time member snapshot. */
    useEventSenderSnapshot?: boolean;

    /** Whether the timestamp should be hidden for preview rendering. */
    hideTimestamp?: boolean;
    /** Whether interactive controls inside the tile should be inhibited. */
    inhibitInteraction?: boolean;

    /** Ref for imperative access to the unwrapped tile instance. */
    ref?: Ref<UnwrappedEventTile>;
}

interface IState {
    interaction: EventTileInteractionState;

    // The Relations model from the JS SDK for reactions to `mxEvent`
    reactions?: Relations | null | undefined;

    isQuoteExpanded?: boolean;

    thread: Thread | null;
}

interface EventTileRenderInputs {
    hasPinnedMessageBadge: boolean;
    hasReactionsRow: boolean;
    threadState: EventTileThreadState;
    isOwnEvent: boolean;
}

/** EventTile implementation rendered inside a RoomContext with `timelineRenderingType` set. */
export class UnwrappedEventTile extends React.Component<EventTileProps, IState> {
    private suppressReadReceiptAnimation: boolean;
    private isListeningForReceipts: boolean;
    private tile = createRef<IEventTileType>();
    private replyChain = createRef<ReplyChain>();
    private readonly viewModel: EventTileViewModel;
    private readonly e2eViewModel: EventTileE2eViewModel;
    private readonly unreadNotificationBadgeViewModel?: UnreadNotificationBadgeViewModel;
    private e2eViewModelSubscription?: () => void;
    private unreadNotificationBadgeViewModelSubscription?: () => void;

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

        this.viewModel = new EventTileViewModel(this.createViewModelDependencies(), this.createViewModelProps());

        this.e2eViewModel = new EventTileE2eViewModel({
            cli: MatrixClientPeg.safeGet(),
            mxEvent: this.props.mxEvent,
            isRoomEncrypted: this.context.isRoomEncrypted,
            eventSendStatus: this.props.eventSendStatus,
            enableListeners: !this.props.forExport,
        });

        if (this.isPreview) {
            this.unreadNotificationBadgeViewModel = new UnreadNotificationBadgeViewModel({
                room: this.getPreviewRoom(),
                threadId: this.props.mxEvent.getId() ?? undefined,
                forceDot: true,
            });
        }

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
        this.unreadNotificationBadgeViewModelSubscription = this.unreadNotificationBadgeViewModel?.subscribe(() => {
            this.forceUpdate();
        });

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

        void client.decryptEventIfNeeded(this.props.mxEvent);

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
        this.unreadNotificationBadgeViewModelSubscription?.();
        this.unreadNotificationBadgeViewModelSubscription = undefined;
        this.unreadNotificationBadgeViewModel?.dispose();
        this.viewModel.dispose();
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
        this.unreadNotificationBadgeViewModel?.setRoom(this.getPreviewRoom());
        this.unreadNotificationBadgeViewModel?.setThreadId(this.props.mxEvent.getId() ?? undefined);
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

    private get isPreview(): boolean {
        return [TimelineRenderingType.Notification, TimelineRenderingType.ThreadsList].includes(
            this.context.timelineRenderingType,
        );
    }

    private getPreviewRoom(): Room | undefined {
        return this.isPreview
            ? (MatrixClientPeg.safeGet().getRoom(this.props.mxEvent.getRoomId()) ?? undefined)
            : undefined;
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

    private readonly onPreviewTileClick = (ev: MouseEvent<HTMLElement>): void => {
        const target = ev.currentTarget;
        const index = target.parentElement ? Array.from(target.parentElement.children).indexOf(target) : -1;

        if (this.context.timelineRenderingType === TimelineRenderingType.Notification) {
            this.onViewInRoomClick(null);
            return;
        }

        if (this.context.timelineRenderingType === TimelineRenderingType.ThreadsList) {
            dis.dispatch<ShowThreadPayload>({
                action: Action.ShowThread,
                rootEvent: this.props.mxEvent,
                push: true,
            });
            PosthogTrackers.trackInteraction("WebThreadsPanelThreadItem", ev, index);
        }
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
                    <E2eMessageSharedIconAdapter
                        eventTileViewModel={this.viewModel}
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
        const target = event.target;
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

    private readonly getAvatarMember = (): RoomMember | null => {
        if (this.props.mxEvent.getContent().third_party_invite) {
            return this.props.mxEvent.target;
        }

        return this.props.mxEvent.sender;
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

    private createMessageTimestampProps(ts: number): MessageTimestampViewModelProps {
        return {
            showRelative: this.context.timelineRenderingType === TimelineRenderingType.ThreadsList,
            showTwelveHour: this.props.isTwelveHour,
            ts,
            receivedTs: getLateEventInfo(this.props.mxEvent)?.received_ts,
        };
    }

    private createLinkedMessageTimestampProps(
        messageTimestampProps: MessageTimestampViewModelProps,
    ): MessageTimestampViewModelProps {
        return {
            ...messageTimestampProps,
            href: this.getPermalink(),
            onClick: this.onPermalinkClicked,
            onContextMenu: this.onTimestampContextMenu,
        };
    }

    private getPermalink(): string {
        if (this.props.permalinkCreator) {
            return this.props.permalinkCreator.forEvent(this.props.mxEvent.getId()!);
        }

        return "#";
    }

    private createRenderTileProps({
        replacingEventId,
        isSeeingThroughMessageHiddenForModeration,
        permalinkCreator = this.props.permalinkCreator,
    }: {
        replacingEventId?: string;
        isSeeingThroughMessageHiddenForModeration?: boolean;
        permalinkCreator?: RoomPermalinkCreator;
    }): EventTileTypeProps {
        return {
            ...this.props,
            ref: this.tile,
            ...(replacingEventId === undefined ? {} : { replacingEventId }),
            isSeeingThroughMessageHiddenForModeration,
            highlights: this.props.highlights,
            highlightLink: this.props.highlightLink,
            permalinkCreator,
            showHiddenEvents: this.context.showHiddenEvents,
        };
    }

    private createViewModelDependencies(): EventTileViewModelDependencies {
        return {
            mxEvent: this.props.mxEvent,
            matrixClient: MatrixClientPeg.safeGet(),
            showHiddenEvents: this.context.showHiddenEvents,
            hideEvent: shouldHideEventTile({ callEventGrouper: this.props.callEventGrouper }),
        };
    }

    private createRenderInputs(): EventTileRenderInputs {
        const isRedacted = isMessageEvent(this.props.mxEvent) && this.props.isRedacted;
        const hasPinnedMessageBadge = PinningUtils.isPinned(MatrixClientPeg.safeGet(), this.props.mxEvent);
        const hasReactionsRow = !isRedacted;
        const threadState = this.threadState;
        // Use `getSender()` because searched events might not have a proper `sender`.
        const isOwnEvent = this.props.mxEvent?.getSender() === MatrixClientPeg.safeGet().getUserId();

        return {
            hasPinnedMessageBadge,
            hasReactionsRow,
            threadState,
            isOwnEvent,
        };
    }

    private createViewModelProps(inputs: EventTileRenderInputs = this.createRenderInputs()): EventTileViewModelProps {
        const { hasPinnedMessageBadge, hasReactionsRow, threadState, isOwnEvent } = inputs;
        const isProbablyMedia = MediaEventHelper.isEligible(this.props.mxEvent);
        const isEditing = !!this.props.editState;
        const isSending =
            this.props.eventSendStatus === EventStatus.SENDING ||
            this.props.eventSendStatus === EventStatus.QUEUED ||
            this.props.eventSendStatus === EventStatus.ENCRYPTING;

        return {
            shape: this.props.shape,
            event: {
                isSending,
                ariaLive: this.props.eventSendStatus === null ? undefined : "off",
                isEditing,
                forExport: this.props.forExport,
            },
            display: {
                timelineRenderingType: this.context.timelineRenderingType,
                layout: this.props.layout,
                continuation: this.props.continuation,
                isProbablyMedia,
                isHighlighted: shouldHighlightEventTile({
                    cli: MatrixClientPeg.safeGet(),
                    mxEvent: this.props.mxEvent,
                    timelineRenderingType: this.context.timelineRenderingType,
                    forExport: this.props.forExport,
                    isRedacted: this.props.isRedacted,
                }),
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
                member: roomMemberToMemberInfo(
                    this.props.useEventSenderSnapshot
                        ? this.getAvatarMember()
                        : resolveRoomMemberProfile({
                              room: MatrixClientPeg.safeGet().getRoom(this.props.mxEvent.getRoomId() ?? ""),
                              userId: this.props.mxEvent.getSender() ?? undefined,
                              member: this.getAvatarMember(),
                              useOnlyCurrentProfiles: SettingsStore.getValue("useOnlyCurrentProfiles"),
                              timelineRenderingType: this.context.timelineRenderingType,
                          }),
                ),
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
        };
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
        const { isQuoteExpanded } = this.state;
        const renderInputs = this.createRenderInputs();
        const { hasPinnedMessageBadge, hasReactionsRow, threadState } = renderInputs;

        this.viewModel.setInputs(this.createViewModelDependencies(), this.createViewModelProps(renderInputs));
        const eventTileRenderState = this.viewModel.getSnapshot();
        const eventTileSnapshot = eventTileRenderState.snapshot;

        // This shouldn't happen: the caller should check we support this type
        // before trying to instantiate us
        if (!eventTileSnapshot.event.hasRenderer) {
            logger.warn(
                `Event type not supported: type:${eventTileSnapshot.event.eventType} isState:${eventTileSnapshot.event.isState}`,
            );
            return (
                <div className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
                    <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
                </div>
            );
        }

        const isRenderingNotification = eventTileSnapshot.event.isRenderingNotification;
        const isSeeingThroughMessageHiddenForModeration =
            eventTileSnapshot.event.isSeeingThroughMessageHiddenForModeration;

        const permalink = this.getPermalink();

        // Sender slots.
        const avatarMember = this.getAvatarMember();
        const avatar =
            avatarMember && eventTileSnapshot.sender.profileState.avatarSize !== null ? (
                <EventTileAvatarAdapter avatarMember={avatarMember} senderSnapshot={eventTileSnapshot.sender} />
            ) : undefined;
        const sender =
            eventTileSnapshot.sender.profileMode !== "hidden" && !eventTileSnapshot.sender.isEmote ? (
                <EventTileSenderAdapter
                    sender={eventTileSnapshot.sender}
                    onSenderProfileClick={this.onSenderProfileClick}
                />
            ) : undefined;

        // Interaction slots.
        const actionBar =
            eventTileRenderState.root.shape === "ThreadsList" ? (
                <ThreadListActionBarAdapter
                    eventTileViewModel={this.viewModel}
                    onViewInRoomClick={this.onViewInRoomClick}
                    onCopyLinkClick={this.onCopyLinkToThreadClick}
                    className="mx_ThreadActionBar"
                />
            ) : eventTileSnapshot.actionBar.show ? (
                <ActionBarAdapter
                    eventTileViewModel={this.viewModel}
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

        // Timestamp slots.
        const ts = eventTileRenderState.timestamp.value;

        const messageTimestampProps = this.createMessageTimestampProps(ts);
        const linkedMessageTimestampProps = this.createLinkedMessageTimestampProps(messageTimestampProps);

        const plainTimestamp = eventTileRenderState.timestamp.displayState.showRealTimestamp ? (
            <MessageTimestampAdapter
                eventTileViewModel={this.viewModel}
                kind="plain"
                timestampProps={messageTimestampProps}
            />
        ) : undefined;
        const linkedTimestamp = eventTileRenderState.timestamp.displayState.showLinkedTimestamp ? (
            <MessageTimestampAdapter
                eventTileViewModel={this.viewModel}
                kind="linked"
                timestampProps={linkedMessageTimestampProps}
            />
        ) : undefined;
        const timestamp =
            eventTileRenderState.root.shape === "File" || this.isPreview ? plainTimestamp : linkedTimestamp;
        const timestampSlot =
            timestamp ??
            (eventTileRenderState.timestamp.displayState.useIRCLayout ? <span aria-hidden="true" /> : undefined);

        // Receipt slots.
        const receiptState = this.receiptState;
        const isFileShape = eventTileRenderState.root.shape === "File";
        const receipt =
            !isFileShape &&
            (this.props.showReadReceipts ||
                receiptState.shouldShowSentReceipt ||
                receiptState.shouldShowSendingReceipt) ? (
                <ReceiptAdapter
                    receiptState={receiptState}
                    eventSendStatus={this.props.eventSendStatus}
                    readReceipts={this.props.readReceipts}
                    readReceiptMap={this.props.readReceiptMap}
                    checkUnmounting={this.props.checkUnmounting}
                    suppressAnimation={this.suppressReadReceiptAnimation}
                    isTwelveHour={this.props.isTwelveHour}
                />
            ) : undefined;

        // Reply slots.
        const replyChain = eventTileSnapshot.root.state.hasReply ? (
            <ReplyChain
                parentEv={this.props.mxEvent}
                ref={this.replyChain}
                forExport={this.props.forExport}
                permalinkCreator={this.props.permalinkCreator}
                alwaysShowTimestamps={eventTileSnapshot.replyChain.alwaysShowTimestamps}
                isQuoteExpanded={isQuoteExpanded}
                setQuoteExpanded={this.setQuoteExpanded}
                getRelationsForEvent={this.props.getRelationsForEvent}
            />
        ) : undefined;

        // Preview body.
        const { hasFooter, showMainPinnedMessageBadge, showBubblePinnedMessageBadge } = eventTileRenderState.footer;
        const isPreview = this.isPreview;
        const room = this.getPreviewRoom();
        const body = isPreview ? (
            <EventTilePreviewBody eventTileViewModel={this.viewModel} mxEvent={this.props.mxEvent} />
        ) : (
            renderTile(
                this.context.timelineRenderingType,
                this.createRenderTileProps({
                    replacingEventId:
                        eventTileRenderState.root.shape === "Thread"
                            ? eventTileSnapshot.event.replacingEventId
                            : undefined,
                    isSeeingThroughMessageHiddenForModeration,
                    permalinkCreator:
                        eventTileRenderState.root.shape === "Thread" ? this.props.permalinkCreator! : undefined,
                }),
            )
        );

        // Footer slots.
        const footer = hasFooter ? (
            <EventTileFooter
                eventTileViewModel={this.viewModel}
                mxEvent={this.props.mxEvent}
                reactions={this.state.reactions}
                hasFooter={hasFooter}
                hasPinnedMessageBadge={hasPinnedMessageBadge}
                hasReactionsRow={hasReactionsRow}
                pinnedMessageBadgeAriaDescribedBy={this.id}
                placement={eventTileRenderState.footer.showInIrcLayout ? "irc" : "default"}
                showMainPinnedMessageBadge={showMainPinnedMessageBadge}
                showBubblePinnedMessageBadge={showBubblePinnedMessageBadge}
            />
        ) : undefined;

        // Thread info slots.
        const shouldRenderThreadInfo = isPreview
            ? threadState.shouldShowThreadPanelSummary
            : threadState.shouldShowThreadSummary || threadState.searchThreadInfo.kind !== "none";
        const threadInfo = shouldRenderThreadInfo ? (
            isPreview ? (
                <EventTileThreadPanelSummary eventTileViewModel={this.viewModel} threadState={threadState} />
            ) : (
                <EventTileThreadInfo
                    eventTileViewModel={this.viewModel}
                    mxEvent={this.props.mxEvent}
                    threadState={threadState}
                />
            )
        ) : undefined;

        // Padlock slots.
        const e2ePadlockState = this.e2eViewModel.getSnapshot();
        const padlock =
            (eventTileRenderState.e2ePadlock.showInGroupLine || eventTileRenderState.e2ePadlock.showInIrcLine) &&
            e2ePadlockState.kind !== "none"
                ? this.renderE2EPadlock()
                : undefined;

        // Notification and room slots.
        const notificationBadge = this.unreadNotificationBadgeViewModel?.getSnapshot().shouldRender ? (
            <NotificationBadgeView vm={this.unreadNotificationBadgeViewModel} />
        ) : undefined;
        const roomAvatar = isRenderingNotification && room ? <RoomAvatar room={room} size="28px" /> : undefined;
        const notificationRoomLabel =
            isRenderingNotification && room ? (
                <> {_t("timeline|in_room_name", { room: room.name }, { strong: (sub) => <strong>{sub}</strong> })}</>
            ) : undefined;

        // Shared tile shell.
        return (
            <EventTileView
                root={{
                    ...eventTileRenderState.root,
                    id: this.id,
                    as: this.props.as,
                    permalink,
                }}
                line={eventTileRenderState.line}
                classNames={eventTileRenderState.classNames}
                slots={{
                    avatar,
                    sender,
                    body,
                    timestamp: timestampSlot,
                    padlock,
                    replyChain,
                    actionBar,
                    footer,
                    threadInfo,
                    receipt,
                    roomAvatar,
                    notificationRoomLabel,
                    notificationBadge,
                    contextMenu: this.renderContextMenu(),
                }}
                refs={{ root: this.ref }}
                onMouseEnter={this.onMouseEnter}
                onMouseLeave={this.onMouseLeave}
                onFocus={this.onFocusWithin}
                onBlur={this.onBlurWithin}
                onClick={this.onPreviewTileClick}
                onContextMenu={this.onContextMenu}
                onPermalinkClick={this.onPermalinkClicked}
                onPermalinkContextMenu={this.onTimestampContextMenu}
            />
        );
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

/** EventTile wrapped in an error boundary so render and construction failures show a tile fallback. */
const SafeEventTile = (props: EventTileProps): JSX.Element => {
    return (
        <EventTileErrorBoundary mxEvent={props.mxEvent}>
            <UnwrappedEventTile {...props} />
        </EventTileErrorBoundary>
    );
};
export default SafeEventTile;
