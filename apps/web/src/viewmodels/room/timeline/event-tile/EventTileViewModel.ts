/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    CryptoEvent,
    DecryptionFailureCode,
    EventShieldColour,
    EventShieldReason,
    type UserVerificationStatus,
} from "matrix-js-sdk/src/crypto-api";
import {
    EventStatus,
    EventType,
    MsgType,
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    type NotificationCountType,
    type Relations,
    type Room,
    type RoomMember,
    RoomEvent,
    ThreadEvent,
    type Thread,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { CallErrorCode } from "matrix-js-sdk/src/webrtc/call";
import { BaseViewModel, Disposables } from "@element-hq/web-shared-components";
import classNames from "classnames";

import type LegacyCallEventGrouper from "../../../../components/structures/LegacyCallEventGrouper";
import {
    buildContextMenuState,
    copyLinkToThread,
    onListTileClick,
    onPermalinkClicked,
    openEventInRoom,
    type EventTileCommandContext,
    type EventTileCommandDeps,
} from "../../../../components/views/rooms/EventTile/EventTileCommands";
import {
    AvatarSubject,
    AvatarSize,
    ClickMode,
    EventTileRenderMode,
    EncryptionIndicatorMode,
    PadlockMode,
    SenderMode,
    TimestampDisplayMode,
    TimestampFormatMode,
    ThreadPanelMode,
    ThreadInfoMode,
} from "../../../../models/rooms/EventTileModel";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { ElementCallEventType } from "../../../../call-types";
import { DecryptionFailureTracker } from "../../../../DecryptionFailureTracker";
import { isMessageEvent } from "../../../../events/EventTileFactory";
import { _t } from "../../../../languageHandler";
import type {
    EventTileContextMenuState,
    GetRelationsForEvent,
    ReadReceiptProps,
} from "../../../../components/views/rooms/EventTile/types";
import { Layout } from "../../../../settings/enums/Layout";
import { getEventDisplayInfo } from "../../../../utils/EventRenderingUtils";
import { getLateEventInfo } from "../../../../components/structures/grouper/LateEventGrouper";
import { isLocalRoom } from "../../../../utils/localRoom/isLocalRoom";
import { MediaEventHelper as TileMediaEventHelper } from "../../../../utils/MediaEventHelper";
import { shouldDisplayReply } from "../../../../utils/Reply";
import type EditorStateTransfer from "../../../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import PinningUtils from "../../../../utils/PinningUtils";
import { isContentActionable } from "../../../../utils/EventUtils";
import { Action } from "../../../../dispatcher/actions";
import type { ComposerInsertPayload } from "../../../../dispatcher/payloads/ComposerInsertPayload";
import type { UserStatus } from "../../../../hooks/useUserStatus";
import {
    EventTileActionBarViewModel,
    type EventTileActionBarViewModelProps,
} from "./actions/EventTileActionBarViewModel";
import {
    DisambiguatedProfileViewModel,
    type DisambiguatedProfileViewModelProps,
} from "./DisambiguatedProfileViewModel";
import { ReactionsRowViewModel } from "./reactions/ReactionsRowViewModel";
import { MessageTimestampViewModel, type MessageTimestampViewModelProps } from "./timestamp/MessageTimestampViewModel";
import { ThreadListActionBarViewModel } from "../../ThreadListActionBarViewModel";

/** Interaction-only state that changes in response to pointer and focus events. */
interface EventTileInteractionSnapshot {
    /** Whether the tile action bar should be presented as focused. */
    actionBarFocused: boolean;
    /** Whether the tile is currently hovered. */
    hover: boolean;
    /** Whether focus is currently inside the tile subtree. */
    focusWithin: boolean;
    /** Whether keyboard-visible focus should force the action bar to show. */
    showActionBarFromFocus: boolean;
    /** Whether the tile context menu is currently open. */
    isContextMenuOpen: boolean;
    /** Full context-menu state for rendering the current menu instance. */
    contextMenuState?: EventTileContextMenuState;
    /** Whether the reply quote preview is expanded. */
    isQuoteExpanded?: boolean;
}

/** Derived receipt and reaction state for the tile footer. */
interface EventTileReceiptSnapshot {
    /** Whether the tile should show the sent receipt state. */
    shouldShowSentReceipt: boolean;
    /** Whether the tile should show the sending receipt state. */
    shouldShowSendingReceipt: boolean;
    /** Whether read receipts should be rendered for this tile. */
    showReadReceipts: boolean;
}

/** Rendering decisions that shape the tile body and footer layout. */
interface EventTileRenderingSnapshot {
    /** Whether the event should render with highlighted styling. */
    isHighlighted: boolean;
    /** Whether the tile is a continuation of the previous sender block. */
    isContinuation: boolean;
    /** Whether the event is still in a local sending state. */
    isSending: boolean;
    /** Whether the event is currently being edited. */
    isEditing: boolean;
    /** Whether the tile should show a reply preview above the event content. */
    showReplyPreview: boolean;
    /** Whether the tile should currently render the reply preview component. */
    shouldRenderReplyPreview: boolean;
    /** Whether the tile should currently render the action bar. */
    shouldRenderActionBar: boolean;
    /** The event renderer mode chosen for the tile body. */
    renderMode: EventTileRenderMode;
    /** Whether a dedicated renderer exists for the event content. */
    hasRenderer: boolean;
    /** The high-level timeline rendering type for the tile. */
    tileRenderType: TimelineRenderingType;
    /** Whether the event should render as a bubble-style message. */
    isBubbleMessage: boolean;
    /** Whether the event should render as an informational message. */
    isInfoMessage: boolean;
    /** Whether the bubble should be left-aligned instead of sender-aligned. */
    isLeftAlignedBubbleMessage: boolean;
    /** Whether the event should suppress bubble styling entirely. */
    noBubbleEvent: boolean;
    /** Whether hidden-for-moderation content is currently being revealed through the tile UI. */
    isSeeingThroughMessageHiddenForModeration: boolean;
    /** Whether the event is currently pinned in the room. */
    isPinned: boolean;
    /** Whether the tile should render footer content. */
    hasFooter: boolean;
}

/** Timestamp and permalink data derived for the tile header or footer. */
interface EventTileTimestampSnapshot {
    /** Whether the timestamp should currently be visible. */
    showTimestamp: boolean;
    /** The permalink for this event, or an empty string when unavailable. */
    permalink: string;
    /** The DOM scroll token used to anchor this tile in scroll state restoration. */
    scrollToken?: string;
    /** The visual timestamp presentation mode. */
    timestampDisplayMode: TimestampDisplayMode;
    /** The formatting style used when rendering the timestamp. */
    timestampFormatMode: TimestampFormatMode;
    /** The timestamp value, in milliseconds since the Unix epoch. */
    timestampTs: number;
    /** Received timestamp for late-event rendering, when available. */
    receivedTs?: number;
}

/** Thread-related state derived from the event and current room context. */
interface EventTileThreadSnapshot {
    /** The thread associated with the event, if any. */
    thread: Thread | null;
    /** A stable change key used to invalidate thread-dependent rendering. */
    threadUpdateKey: string;
    /** The thread notification type to surface for this tile. */
    threadNotification?: NotificationCountType;
    /** Whether the event is associated with a thread. */
    hasThread: boolean;
    /** Whether the event is the root event of a thread. */
    isThreadRoot: boolean;
    /** The thread panel layout mode to render below the tile. */
    threadPanelMode: ThreadPanelMode;
    /** The thread metadata mode to render inline with the tile. */
    threadInfoMode: ThreadInfoMode;
    /** Optional href used by the inline thread info affordance. */
    threadInfoHref?: string;
    /** Optional label used by the inline thread info affordance. */
    threadInfoLabel?: string;
    /** Reply count to surface below the tile when thread summary UI is shown. */
    threadReplyCount?: number;
    /** Whether the thread reply preview should be rendered below the tile. */
    shouldRenderThreadPreview: boolean;
    /** Whether the thread action toolbar should be rendered below the tile. */
    shouldRenderThreadToolbar: boolean;
    /** The primary click action exposed by the tile. */
    tileClickMode: ClickMode;
    /** Whether the tile is currently rendered in search results. */
    openedFromSearch: boolean;
}

/** Sender and avatar presentation derived for the tile. */
interface EventTileSenderSnapshot {
    /** Whether the event sender is the current user. */
    isOwnEvent: boolean;
    /** Whether sender information should be shown. */
    showSender: boolean;
    /** Whether the sender profile node should be rendered. */
    showSenderProfile: boolean;
    /** Which entity the avatar should represent. */
    avatarSubject: AvatarSubject;
    /** The avatar size to render. */
    avatarSize: AvatarSize;
    /** Whether clicking the avatar should target the member or user affordance. */
    avatarMemberUserOnClick: boolean;
    /** Whether avatar lookup should prefer historical membership data. */
    avatarForceHistorical: boolean;
    /** The sender presentation mode to use. */
    senderMode: SenderMode;
}

/** Encryption and room-security presentation state for the tile. */
interface EventTileEncryptionSnapshot {
    /** The verification shield color derived for the event. */
    shieldColour: EventShieldColour;
    /** The verification or warning reason associated with the shield. */
    shieldReason: EventShieldReason | null;
    /** Whether the event is currently in a decryption failure state. */
    isEncryptionFailure: boolean;
    /** The padlock badge mode to render for room context. */
    padlockMode: PadlockMode;
    /** The encryption indicator mode to show in the tile chrome. */
    encryptionIndicatorMode: EncryptionIndicatorMode;
    /** The user ID that shared keys for the event, when available. */
    sharedKeysUserId?: string;
    /** The room ID associated with the shared keys, when available. */
    sharedKeysRoomId?: string;
    /** Optional tooltip title for the encryption indicator. */
    encryptionIndicatorTitle?: string;
}

/** Additional presentational data currently derived alongside the VM snapshot. */
interface EventTilePresentationSnapshot {
    /** Optional event ID attached to the rendered tile root. */
    eventId?: string;
    /** Optional aria-live setting for the rendered tile root. */
    ariaLive?: "off";
    /** CSS class name for the tile root. */
    rootClassName: string;
    /** CSS class name for the tile content wrapper. */
    contentClassName: string;
    /** Whether the tile is rendered in notifications mode. */
    isNotification: boolean;
    /** Whether the tile behaves like a clickable list item. */
    isListLikeTile: boolean;
    /** Plain room name for notification list rendering. */
    notificationRoomName?: string;
    /** Whether the thin view should render the missing-renderer fallback path. */
    shouldRenderMissingRendererFallback: boolean;
}

/** Shared intermediate values used while deriving a tile snapshot. */
interface EventTileDerivationContext {
    /** Event display metadata reused across rendering decisions. */
    displayInfo: ReturnType<typeof getEventDisplayInfo>;
    /** The verification shield color derived for the event. */
    shieldColour: EventShieldColour;
    /** The verification or warning reason associated with the shield. */
    shieldReason: EventShieldReason | null;
    /** The reaction aggregation for the event, if reactions are being tracked. */
    reactions: Relations | null;
    /** The thread associated with the event, if any. */
    thread: Thread | null;
    /** The thread notification type to surface for this tile. */
    threadNotification?: NotificationCountType;
    /** Whether the event is associated with a thread. */
    hasThread: boolean;
    /** Whether the event is the root event of a thread. */
    isThreadRoot: boolean;
    /** Whether sender information should be shown. */
    showSender: boolean;
    /** Shared sender/avatar presentation classification for the tile. */
    senderPresentation: EventTileSenderPresentationContext;
    /** Whether the event is currently in a decryption failure state. */
    isEncryptionFailure: boolean;
    /** Whether the timestamp should currently be visible. */
    showTimestamp: boolean;
}

/** Shared sender/avatar classification reused across sender derivation helpers. */
interface EventTileSenderPresentationContext {
    /** The avatar size to render. */
    avatarSize: AvatarSize;
    /** Whether the sender should be treated as a profile-bearing identity. */
    needsSenderProfile: boolean;
}

/** Fully derived view state consumed by the `EventTile` rendering layer. */
export interface EventTileViewSnapshot {
    /** Interaction-only state that changes in response to pointer and focus events. */
    interaction: EventTileInteractionSnapshot;
    /** Derived receipt and reaction state for the tile footer. */
    receipt: EventTileReceiptSnapshot;
    /** Rendering decisions that shape the tile body and footer layout. */
    rendering: EventTileRenderingSnapshot;
    /** Timestamp and permalink data derived for the tile header or footer. */
    timestamp: EventTileTimestampSnapshot;
    /** Thread-related state derived from the event and current room context. */
    thread: EventTileThreadSnapshot;
    /** Sender and avatar presentation derived for the tile. */
    sender: EventTileSenderSnapshot;
    /** Encryption and room-security presentation state for the tile. */
    encryption: EventTileEncryptionSnapshot;
    /** Additional presentational data currently derived alongside the VM snapshot. */
    presentation: EventTilePresentationSnapshot;
}

type EventTileViewSnapshotUpdate = {
    interaction?: Partial<EventTileInteractionSnapshot>;
    receipt?: Partial<EventTileReceiptSnapshot>;
    rendering?: Partial<EventTileRenderingSnapshot>;
    timestamp?: Partial<EventTileTimestampSnapshot>;
    thread?: Partial<EventTileThreadSnapshot>;
    sender?: Partial<EventTileSenderSnapshot>;
    encryption?: Partial<EventTileEncryptionSnapshot>;
    presentation?: Partial<EventTilePresentationSnapshot>;
};

/** Core event and service dependencies required by the view model. */
interface EventTileCoreProps {
    /** The Matrix client used for decryption, receipts, and room lookups. */
    cli: MatrixClient;
    /** The Matrix event represented by this tile. */
    mxEvent: MatrixEvent;
    /** Sender profile data resolved at the React boundary. */
    senderMember?: RoomMember | null;
    /** Sender status resolved at the React boundary. */
    senderUserStatus?: UserStatus;
    /** The local send status override for the event, when applicable. */
    eventSendStatus?: EventStatus;
    /** The current composer edit state associated with the event. */
    editState?: EditorStateTransfer;
    /** Optional permalink helper used to generate event links. */
    permalinkCreator?: RoomPermalinkCreator;
    /** Optional helper used to group legacy call events. */
    callEventGrouper?: LegacyCallEventGrouper;
}

/** Rendering flags and layout context that influence tile presentation. */
interface EventTileRenderingProps {
    /** Whether the tile is being rendered for export rather than live interaction. */
    forExport?: boolean;
    /** The timeline rendering mode for the current room view. */
    timelineRenderingType: TimelineRenderingType;
    /** The active room layout variant. */
    layout?: Layout;
    /** Whether timestamps should use a twelve-hour clock. */
    isTwelveHour?: boolean;
    /** Whether timestamps should always be visible regardless of hover state. */
    alwaysShowTimestamps?: boolean;
    /** Whether the event should be treated as redacted for rendering purposes. */
    isRedacted?: boolean;
    /** Whether this tile visually continues the previous event group. */
    continuation?: boolean;
    /** Whether this is the last visible tile in the current list. */
    last?: boolean;
    /** Whether this is the last tile in its grouped section. */
    lastInSection?: boolean;
    /** Whether the tile is being rendered in a contextual timeline. */
    contextual?: boolean;
    /** Whether this tile corresponds to the currently selected event. */
    isSelectedEvent?: boolean;
    /** Whether hidden events should still be rendered. */
    showHiddenEvents: boolean;
    /** Whether the room containing the event is encrypted. */
    isRoomEncrypted: boolean;
    /** Whether sender information should be suppressed. */
    hideSender?: boolean;
    /** Whether timestamp rendering should be suppressed. */
    hideTimestamp?: boolean;
    /** Whether interactive affordances should be disabled. */
    inhibitInteraction?: boolean;
    /** A link target used to highlight matching content inside the tile. */
    highlightLink?: string;
    /** Whether the current user can send message-based actions such as reply. */
    canSendMessages?: boolean;
    /** Whether the current user can react to this event. */
    canReact?: boolean;
    /** Whether this tile is being rendered in search results. */
    isSearch?: boolean;
    /** Whether this tile is being rendered inside a card-style surface. */
    isCard?: boolean;
}

/** Optional relation and receipt inputs used to enrich tile footer state. */
interface EventTileRelationProps {
    /** Whether reaction aggregation should be computed and displayed. */
    showReactions?: boolean;
    /** Optional relation lookup function for the event. */
    getRelationsForEvent?: GetRelationsForEvent;
    /** Read receipt data available for the tile. */
    readReceipts?: ReadReceiptProps[];
    /** Whether read receipts should be rendered when available. */
    showReadReceipts?: boolean;
    /** Whether this event is the most recent successfully sent event. */
    lastSuccessful?: boolean;
}

/** Side-effect dependencies used by command-oriented VM methods. */
interface EventTileCommandProps {
    /** Dispatcher, clipboard, analytics, and platform-policy command services. */
    commandDeps: EventTileCommandDeps;
}

/** Inputs required to derive the `EventTile` view snapshot. */
export type EventTileViewModelProps = EventTileCoreProps &
    EventTileRenderingProps &
    EventTileRelationProps &
    EventTileCommandProps;

/** Derives and maintains render state for a single timeline event tile. */
export class EventTileViewModel extends BaseViewModel<EventTileViewSnapshot, EventTileViewModelProps> {
    // Multiplex client-level trust updates so timelines do not add one MatrixClient listener per tile.
    private static readonly cliTrustListenerRegistry = new WeakMap<
        MatrixClient,
        {
            listeners: Set<(userId: string, trustStatus: UserVerificationStatus) => void>;
            handler: (userId: string, trustStatus: UserVerificationStatus) => void;
        }
    >();

    // Multiplex room-level thread updates so timelines do not add one Room listener per tile/thread.
    private static readonly roomThreadListenerRegistry = new WeakMap<
        Room,
        {
            listenersByEventId: Map<string, Set<(thread: Thread) => void>>;
            handler: (thread: Thread) => void;
        }
    >();

    private isListeningForReceipts = false;
    private verifyGeneration = 0;
    private currentRoom: Room | null = null;
    private currentRoomThreadEventId: string | null = null;
    private cliDisposables = new Disposables();
    private eventDisposables = new Disposables();
    private roomDisposables = new Disposables();
    private receiptDisposables = new Disposables();
    private reactions: Relations | null;
    private eventTileActionBarViewModel?: EventTileActionBarViewModel;
    private readonly eventTileReactionsRowViewModel: ReactionsRowViewModel;
    private readonly eventTileDisambiguatedProfileViewModel: DisambiguatedProfileViewModel;
    private readonly eventTileTimestampViewModel: MessageTimestampViewModel;
    private readonly eventTileThreadToolbarViewModel: ThreadListActionBarViewModel;

    /** Creates a view model for a single event tile. */
    public constructor(props: EventTileViewModelProps) {
        const reactions = EventTileViewModel.getReactions(props);

        super(props, EventTileViewModel.deriveSnapshot(props, undefined, {}, reactions));

        this.reactions = reactions;

        this.eventTileReactionsRowViewModel = this.disposables.track(
            new ReactionsRowViewModel(EventTileViewModel.buildReactionsRowViewModelProps(props, this.reactions)),
        );
        this.eventTileDisambiguatedProfileViewModel = this.disposables.track(
            new DisambiguatedProfileViewModel(this.buildDisambiguatedProfileViewModelProps(props)),
        );
        this.eventTileTimestampViewModel = this.disposables.track(
            new MessageTimestampViewModel(this.buildTimestampViewModelProps(this.snapshot.current, props)),
        );
        this.eventTileThreadToolbarViewModel = this.disposables.track(
            new ThreadListActionBarViewModel({
                onViewInRoomClick: this.onThreadToolbarViewInRoomClick,
                onCopyLinkClick: this.onThreadToolbarCopyLinkClick,
            }),
        );

        this.rebindListeners(null, props);
        this.updateReceiptListener();
        this.decryptEventIfNeeded();
    }

    public get reactionsRowViewModel(): ReactionsRowViewModel {
        return this.eventTileReactionsRowViewModel;
    }

    public get disambiguatedProfileViewModel(): DisambiguatedProfileViewModel {
        return this.eventTileDisambiguatedProfileViewModel;
    }

    public get timestampViewModel(): MessageTimestampViewModel {
        return this.eventTileTimestampViewModel;
    }

    public get threadToolbarViewModel(): ThreadListActionBarViewModel {
        return this.eventTileThreadToolbarViewModel;
    }

    public getReactions(): Relations | null {
        return this.reactions;
    }

    public getActionBarViewModel(): EventTileActionBarViewModel {
        return (this.eventTileActionBarViewModel ??= this.disposables.track(
            new EventTileActionBarViewModel(
                EventTileViewModel.buildActionBarViewModelProps(
                    this.props,
                    this.snapshot.current.interaction.isQuoteExpanded,
                    this.onToggleThreadExpanded,
                ),
            ),
        ));
    }

    private onSenderProfileClick: DisambiguatedProfileViewModelProps["onClick"] = (): void => {
        const userId = this.props.mxEvent.getSender();
        if (!userId) return;

        const payload: ComposerInsertPayload = {
            action: Action.ComposerInsert,
            userId,
            timelineRenderingType: this.props.timelineRenderingType,
        };
        this.props.commandDeps.dispatch(payload);
    };

    private onTimestampPermalinkClick: MessageTimestampViewModelProps["onClick"] = (ev): void => {
        this.onPermalinkClicked(ev);
    };

    private onTimestampContextMenu: MessageTimestampViewModelProps["onContextMenu"] = (ev): void => {
        const eventId = this.props.mxEvent.getId();

        this.openContextMenu(ev, eventId ? this.props.permalinkCreator?.forEvent(eventId) : undefined);
    };

    /** Releases all Matrix listeners owned by this view model. */
    public override dispose(): void {
        this.unbindAllListeners();
        super.dispose();
    }

    /** Updates whether the tile is currently hovered. */
    public setHover(hover: boolean): void {
        this.updateInteractionSnapshot({ hover });
    }

    /** Updates whether the quoted reply preview is expanded. */
    public setQuoteExpanded(isQuoteExpanded: boolean): void {
        this.updateInteractionSnapshot({ isQuoteExpanded });
        this.eventTileActionBarViewModel?.updateProps(
            EventTileViewModel.buildActionBarViewModelProps(
                this.props,
                this.snapshot.current.interaction.isQuoteExpanded,
                this.onToggleThreadExpanded,
            ),
        );
    }

    /** Applies root focus entry state and whether keyboard focus should reveal the action bar. */
    public onFocusEnter(showActionBarFromFocus: boolean): void {
        this.updateInteractionSnapshot({
            focusWithin: true,
            showActionBarFromFocus,
        });
    }

    /** Applies root focus exit state. */
    public onFocusLeave(): void {
        this.updateInteractionSnapshot({
            focusWithin: false,
            showActionBarFromFocus: false,
        });
    }

    /** Applies action-bar focus state and syncs hover state with the current tile hover status. */
    public onActionBarFocusChange(focused: boolean, isTileHovered: boolean): void {
        this.updateInteractionSnapshot({
            actionBarFocused: focused,
            hover: focused ? this.snapshot.current.interaction.hover : isTileHovered,
        });
    }

    /** Applies the interaction state changes required when closing the context menu. */
    private onContextMenuClose(): void {
        this.updateInteractionSnapshot({
            isContextMenuOpen: false,
            actionBarFocused: false,
            contextMenuState: undefined,
            hover: false,
        });
    }

    /** Opens the event in room through the command boundary. */
    public openInRoom(): void {
        openEventInRoom(this.props.commandDeps, this.getCommandContext());
    }

    /** Handles timestamp permalink clicks through the command boundary. */
    public onPermalinkClicked(ev: Pick<MouseEvent, "preventDefault">): void {
        onPermalinkClicked(this.props.commandDeps, this.getCommandContext(), ev);
    }

    /** Copies the thread permalink through the command boundary when available. */
    public async copyLinkToThread(): Promise<void> {
        await copyLinkToThread(this.props.commandDeps, this.getCommandContext());
    }

    /** Opens the tile context menu when the click target should override the native menu. */
    public openContextMenu(
        ev: {
            clientX: number;
            clientY: number;
            target: EventTarget | null;
            preventDefault(): void;
            stopPropagation(): void;
        },
        permalink?: string,
    ): void {
        const contextMenuState = buildContextMenuState(this.props.commandDeps, this.getCommandContext(), ev, permalink);
        if (!contextMenuState) return;

        this.updateInteractionSnapshot({
            isContextMenuOpen: true,
            actionBarFocused: true,
            contextMenuState,
            hover: false,
        });
    }

    /** Closes the tile context menu and clears the stored menu state. */
    public closeContextMenu(): void {
        this.onContextMenuClose();
    }

    /** Handles list-style tile click behavior through the command boundary. */
    public onListTileClick(ev: Event, index: number): void {
        onListTileClick(this.props.commandDeps, this.getCommandContext(), ev, index);
    }

    /** Toggles the reply quote expansion flag. */
    public toggleQuoteExpanded(): void {
        this.setQuoteExpanded(!this.snapshot.current.interaction.isQuoteExpanded);
    }

    /** Replaces the model props and refreshes affected listeners and derived state. */
    public updateProps(props: EventTileViewModelProps): void {
        const previousProps = this.props;
        const previousEvent = previousProps.mxEvent;
        const previousEventSendStatus = previousProps.eventSendStatus;
        const previousShowReactions = previousProps.showReactions;

        this.props = props;
        if (EventTileViewModel.shouldRefreshReactions(previousProps, props)) {
            this.refreshReactions(props);
        }
        this.updateChildViewModels(previousProps, props);
        this.rebindListeners(previousProps, props);
        this.updateSnapshot({
            thread: { thread: EventTileViewModel.getThread(props) },
        });
        this.updateReceiptListener();

        if (
            previousEvent !== props.mxEvent ||
            previousEventSendStatus !== props.eventSendStatus ||
            previousShowReactions !== props.showReactions
        ) {
            if (previousEvent !== props.mxEvent) {
                this.decryptEventIfNeeded();
            }
            this.refreshVerification();
        }
    }

    /** Recomputes the full derived snapshot from the current props and live event state. */
    public refreshDerivedState(): void {
        this.refreshReactions();
        this.updateSnapshot();
        this.updateReactionsRowViewModel();
    }

    /** Re-runs event verification and updates the encryption shield state when the async check completes. */
    public refreshVerification(): void {
        void this.verifyEvent();
    }

    private rebindListeners(previousProps: EventTileViewModelProps | null, nextProps: EventTileViewModelProps): void {
        if (previousProps?.cli !== nextProps.cli || previousProps?.forExport !== nextProps.forExport) {
            // Client-scoped listeners must move when we swap MatrixClient instances or stop/start live rendering.
            this.unbindCliListeners();
            this.bindCliListeners(nextProps);
        }

        if (
            previousProps?.mxEvent !== nextProps.mxEvent ||
            previousProps?.showReactions !== nextProps.showReactions ||
            previousProps?.forExport !== nextProps.forExport
        ) {
            // Event-scoped listeners depend on the current event, whether reactions are shown, and export mode.
            this.unbindEventListeners();
            this.bindEventListeners(nextProps);
        }

        const nextRoom = EventTileViewModel.getRoom(nextProps);
        const nextRoomThreadEventId = EventTileViewModel.getRoomThreadListenerEventId(nextProps);
        if (this.currentRoom !== nextRoom || this.currentRoomThreadEventId !== nextRoomThreadEventId) {
            // Room-scoped listeners follow the room that owns the tile's event.
            this.unbindRoomListeners();
            this.bindRoomListeners(nextRoom, nextRoomThreadEventId);
        }
    }

    private bindCliListeners(props: EventTileViewModelProps): void {
        if (props.forExport) return;

        // Re-verify the encryption shield when the sender's trust state changes.
        this.cliDisposables.track(this.trackCliTrust(props.cli, this.onUserVerificationChanged));
    }

    private unbindCliListeners(): void {
        this.cliDisposables.dispose();
        this.cliDisposables = new Disposables();
        this.unbindReceiptListener();
    }

    private bindEventListeners(props: EventTileViewModelProps): void {
        // Keep thread summary data current as replies are added or thread metadata changes.
        props.mxEvent.on(ThreadEvent.Update, this.onThreadUpdate);
        this.eventDisposables.track(() => props.mxEvent.off(ThreadEvent.Update, this.onThreadUpdate));

        if (props.forExport) return;

        // Recompute rendering and encryption state once an encrypted event finishes decrypting.
        props.mxEvent.on(MatrixEventEvent.Decrypted, this.onDecrypted);
        this.eventDisposables.track(() => props.mxEvent.off(MatrixEventEvent.Decrypted, this.onDecrypted));
        // Update the tile if this event gets edited and its replacement changes what should be rendered.
        props.mxEvent.on(MatrixEventEvent.Replaced, this.onReplaced);
        this.eventDisposables.track(() => props.mxEvent.off(MatrixEventEvent.Replaced, this.onReplaced));
        DecryptionFailureTracker.instance.addVisibleEvent(props.mxEvent);
        this.eventDisposables.track(() => {
            const eventId = props.mxEvent.getId();
            if (eventId) {
                DecryptionFailureTracker.instance.visibleEvents.delete(eventId);
            }
        });

        if (props.showReactions) {
            // Refresh the reaction summary when new reaction relations are attached to the event.
            props.mxEvent.on(MatrixEventEvent.RelationsCreated, this.onReactionsCreated);
            this.eventDisposables.track(() =>
                props.mxEvent.off(MatrixEventEvent.RelationsCreated, this.onReactionsCreated),
            );
        }
    }

    private unbindEventListeners(): void {
        this.eventDisposables.dispose();
        this.eventDisposables = new Disposables();
    }

    private bindRoomListeners(room: Room | null, eventId: string | null): void {
        this.currentRoom = room;
        this.currentRoomThreadEventId = eventId;
        // Pick up the thread object later if this event becomes recognized as a thread root after initial render.
        if (room && eventId) {
            this.roomDisposables.track(this.trackRoomThread(room, eventId, this.onNewThread));
        }
    }

    private unbindRoomListeners(): void {
        this.roomDisposables.dispose();
        this.roomDisposables = new Disposables();
        this.currentRoom = null;
        this.currentRoomThreadEventId = null;
    }

    private unbindAllListeners(): void {
        this.unbindRoomListeners();
        this.unbindEventListeners();
        this.unbindCliListeners();
    }

    private trackRoomThread(room: Room, eventId: string, callback: (thread: Thread) => void): () => void {
        let entry = EventTileViewModel.roomThreadListenerRegistry.get(room);

        if (!entry) {
            const listenersByEventId = new Map<string, Set<(thread: Thread) => void>>();
            const handler = (thread: Thread): void => {
                const listeners = listenersByEventId.get(thread.id);
                if (!listeners) return;

                for (const listener of listeners) {
                    listener(thread);
                }
            };

            entry = { listenersByEventId, handler };
            EventTileViewModel.roomThreadListenerRegistry.set(room, entry);
            room.on(ThreadEvent.New, handler);
        }

        let listeners = entry.listenersByEventId.get(eventId);
        if (!listeners) {
            listeners = new Set();
            entry.listenersByEventId.set(eventId, listeners);
        }

        listeners.add(callback);

        return () => {
            listeners.delete(callback);
            if (listeners.size === 0) {
                entry.listenersByEventId.delete(eventId);
            }
            if (entry.listenersByEventId.size === 0) {
                room.off(ThreadEvent.New, entry.handler);
                EventTileViewModel.roomThreadListenerRegistry.delete(room);
            }
        };
    }

    private trackCliTrust(
        cli: MatrixClient,
        callback: (userId: string, trustStatus: UserVerificationStatus) => void,
    ): () => void {
        let entry = EventTileViewModel.cliTrustListenerRegistry.get(cli);

        if (!entry) {
            const listeners = new Set<(userId: string, trustStatus: UserVerificationStatus) => void>();
            const handler = (userId: string, trustStatus: UserVerificationStatus): void => {
                for (const listener of listeners) {
                    listener(userId, trustStatus);
                }
            };

            entry = { listeners, handler };
            EventTileViewModel.cliTrustListenerRegistry.set(cli, entry);
            cli.on(CryptoEvent.UserTrustStatusChanged, handler);
        }

        entry.listeners.add(callback);

        return () => {
            entry.listeners.delete(callback);
            if (entry.listeners.size === 0) {
                cli.off(CryptoEvent.UserTrustStatusChanged, entry.handler);
                EventTileViewModel.cliTrustListenerRegistry.delete(cli);
            }
        };
    }

    private updateSnapshot(partial?: EventTileViewSnapshotUpdate, syncReceiptListener = true): void {
        const nextSnapshot = EventTileViewModel.deriveSnapshot(
            this.props,
            this.snapshot.current,
            partial,
            this.reactions,
        );

        this.snapshot.merge(nextSnapshot);
        this.updateTimestampViewModel(nextSnapshot);

        if (syncReceiptListener) {
            this.updateReceiptListener(nextSnapshot);
        }
    }

    private mergeSnapshot(partial: EventTileViewSnapshotUpdate): void {
        const nextSnapshot = EventTileViewModel.mergeSnapshotUpdate(this.snapshot.current, partial);

        this.snapshot.merge(nextSnapshot);
        this.updateTimestampViewModel(nextSnapshot);
        this.updateReceiptListener(nextSnapshot);
    }

    private updateReceiptSnapshot(partial: EventTileViewSnapshotUpdate = {}): void {
        const receiptSnapshot = EventTileViewModel.deriveReceiptSnapshot(this.props);

        this.mergeSnapshot({
            ...partial,
            receipt: {
                ...partial.receipt,
                ...receiptSnapshot,
            },
            rendering: {
                ...partial.rendering,
                hasFooter: EventTileViewModel.getHasFooter(
                    this.props.isRedacted,
                    this.snapshot.current.rendering.isPinned,
                    this.reactions,
                ),
            },
        });
        this.updateReactionsRowViewModel();
    }

    private updateThreadSnapshot(thread: Thread | null): void {
        const partial: EventTileViewSnapshotUpdate = { thread: { thread } };
        const baseSnapshot = EventTileViewModel.createBaseSnapshot(this.snapshot.current, partial, this.props);
        const context = EventTileViewModel.createDerivationContext(this.props, baseSnapshot, this.reactions);

        this.mergeSnapshot({
            ...partial,
            thread: {
                ...partial.thread,
                ...EventTileViewModel.deriveThreadSnapshot(this.props, context),
            },
            timestamp: EventTileViewModel.deriveTimestampSnapshot(this.props, baseSnapshot, context),
        });
    }

    private updateVerificationSnapshot(shieldColour: EventShieldColour, shieldReason: EventShieldReason | null): void {
        const partial: EventTileViewSnapshotUpdate = { encryption: { shieldColour, shieldReason } };
        const baseSnapshot = EventTileViewModel.createBaseSnapshot(this.snapshot.current, partial, this.props);
        const context = EventTileViewModel.createDerivationContext(this.props, baseSnapshot, this.reactions);
        const encryptionSnapshot = EventTileViewModel.deriveEncryptionSnapshot(this.props, context);
        const nextEncryptionSnapshot: EventTileEncryptionSnapshot = {
            ...baseSnapshot.encryption,
            ...partial.encryption,
            ...encryptionSnapshot,
        };
        const encryptionIndicatorTitle = EventTileViewModel.getEncryptionIndicatorTitle(
            this.props,
            {
                ...baseSnapshot,
                encryption: nextEncryptionSnapshot,
            },
            encryptionSnapshot.isEncryptionFailure,
        );

        this.mergeSnapshot({
            ...partial,
            encryption: {
                ...partial.encryption,
                ...encryptionSnapshot,
                encryptionIndicatorTitle,
            },
        });
    }

    private updateInteractionSnapshot(partial: Partial<EventTileInteractionSnapshot>): void {
        const nextSnapshot = EventTileViewModel.createBaseSnapshot(
            this.snapshot.current,
            { interaction: partial },
            this.props,
        );
        const interactionDependentSnapshot = EventTileViewModel.deriveInteractionDependentSnapshot(
            this.props,
            nextSnapshot,
        );

        this.mergeSnapshot({
            interaction: partial,
            ...interactionDependentSnapshot,
        });
    }

    private updateReceiptListener(snapshot: EventTileViewSnapshot = this.snapshot.current): void {
        const shouldListen =
            !this.props.forExport &&
            (snapshot.receipt.shouldShowSentReceipt || snapshot.receipt.shouldShowSendingReceipt);
        if (shouldListen && !this.isListeningForReceipts) {
            // Only subscribe to room receipts while this tile renders sent/sending receipt affordances.
            const cli = this.props.cli;
            cli.on(RoomEvent.Receipt, this.onRoomReceipt);
            this.receiptDisposables.track(() => {
                cli.off(RoomEvent.Receipt, this.onRoomReceipt);
            });
            this.isListeningForReceipts = true;
        } else if (!shouldListen && this.isListeningForReceipts) {
            // Drop the receipt listener once receipt state is no longer visible for this tile.
            this.unbindReceiptListener();
        }
    }

    private unbindReceiptListener(): void {
        this.receiptDisposables.dispose();
        this.receiptDisposables = new Disposables();
        this.isListeningForReceipts = false;
    }

    private readonly onRoomReceipt = (_event: MatrixEvent, room: Room): void => {
        const roomId = this.props.mxEvent.getRoomId();
        const tileRoom = roomId ? this.props.cli.getRoom(roomId) : null;
        if (room !== tileRoom) return;

        this.updateReceiptSnapshot();
    };

    private readonly onDecrypted = (): void => {
        this.refreshVerification();
        this.updateSnapshot();
    };

    private readonly onUserVerificationChanged = (userId: string, _trustStatus: UserVerificationStatus): void => {
        if (userId === this.props.mxEvent.getSender()) {
            this.refreshVerification();
        }
    };

    private readonly onReplaced = (): void => {
        this.refreshVerification();
        this.updateSnapshot();
    };

    private readonly onReactionsCreated = (relationType: string, eventType: string): void => {
        if (relationType !== "m.annotation" || eventType !== "m.reaction") {
            return;
        }

        this.refreshReactions();
        this.updateReceiptSnapshot();
    };

    private readonly updateThread = (thread: Thread): void => {
        this.updateThreadSnapshot(thread);
    };

    private readonly onThreadUpdate = (thread: Thread): void => {
        this.updateThread(thread);
    };

    private readonly onNewThread = (thread: Thread): void => {
        this.updateThread(thread);
        this.unbindRoomListeners();
    };

    private readonly onToggleThreadExpanded = (): void => {
        this.toggleQuoteExpanded();
    };

    private readonly onThreadToolbarViewInRoomClick = (): void => {
        this.openInRoom();
    };

    private readonly onThreadToolbarCopyLinkClick = async (): Promise<void> => {
        await this.copyLinkToThread();
    };

    private decryptEventIfNeeded(): void {
        this.props.cli.decryptEventIfNeeded(this.props.mxEvent)?.catch(() => {
            // Match the previous fire-and-forget behaviour without assuming a Promise is always returned.
        });
    }

    private async verifyEvent(): Promise<void> {
        try {
            const verifyGeneration = ++this.verifyGeneration;
            const event = this.props.mxEvent.replacingEvent() ?? this.props.mxEvent;

            if (!event.isEncrypted() || event.isRedacted()) {
                this.updateVerificationSnapshot(EventShieldColour.NONE, null);
                return;
            }

            const encryptionInfo = (await this.props.cli.getCrypto()?.getEncryptionInfoForEvent(event)) ?? null;
            if (this.isDisposed || verifyGeneration !== this.verifyGeneration) {
                return;
            }
            if (encryptionInfo === null) {
                this.updateVerificationSnapshot(EventShieldColour.NONE, null);
                return;
            }

            this.updateVerificationSnapshot(encryptionInfo.shieldColour, encryptionInfo.shieldReason);
        } catch (error) {
            logger.error(
                `Error getting encryption info on event ${this.props.mxEvent.getId()} in room ${this.props.mxEvent.getRoomId()}`,
                error,
            );
        }
    }

    private getCommandContext(): EventTileCommandContext {
        return {
            mxEvent: this.props.mxEvent,
            permalinkCreator: this.props.permalinkCreator,
            openedFromSearch: this.snapshot.current.thread.openedFromSearch,
            tileClickMode: this.snapshot.current.thread.tileClickMode,
            editState: this.props.editState,
        };
    }

    private static buildActionBarViewModelProps(
        props: EventTileViewModelProps,
        isQuoteExpanded: boolean | undefined,
        onToggleThreadExpanded: EventTileActionBarViewModelProps["onToggleThreadExpanded"],
    ): EventTileActionBarViewModelProps {
        return {
            mxEvent: props.mxEvent,
            timelineRenderingType: props.timelineRenderingType,
            canSendMessages: Boolean(props.canSendMessages),
            canReact: Boolean(props.canReact),
            isSearch: props.isSearch,
            isCard: props.isCard,
            isQuoteExpanded,
            onToggleThreadExpanded,
            getRelationsForEvent: props.getRelationsForEvent,
        };
    }

    private static buildReactionsRowViewModelProps(
        props: EventTileViewModelProps,
        reactions: Relations | null,
    ): {
        isActionable: boolean;
        reactionGroupCount: number;
        canReact: boolean;
    } {
        return {
            isActionable: isContentActionable(props.mxEvent),
            reactionGroupCount: EventTileViewModel.getReactionGroupCount(reactions),
            canReact: Boolean(props.canReact),
        };
    }

    private buildDisambiguatedProfileViewModelProps(
        props: EventTileViewModelProps,
    ): DisambiguatedProfileViewModelProps {
        const senderMode = EventTileViewModel.getSenderProfileMode(props);

        return {
            fallbackName: props.mxEvent.getSender() ?? "",
            onClick: senderMode === SenderMode.ComposerInsert ? this.onSenderProfileClick : undefined,
            member: props.senderMember,
            colored: true,
            emphasizeDisplayName: true,
            withTooltip: senderMode === SenderMode.Tooltip,
            userStatus: props.senderUserStatus,
        };
    }

    private buildTimestampViewModelProps(
        snapshot: EventTileViewSnapshot,
        props: EventTileViewModelProps,
    ): MessageTimestampViewModelProps {
        const isLinked = snapshot.timestamp.timestampDisplayMode === TimestampDisplayMode.Linked;

        return {
            showRelative: snapshot.timestamp.timestampFormatMode === TimestampFormatMode.Relative,
            showTwelveHour: props.isTwelveHour,
            ts: snapshot.timestamp.timestampTs,
            receivedTs: snapshot.timestamp.receivedTs,
            href: isLinked ? snapshot.timestamp.permalink : undefined,
            onClick: isLinked ? this.onTimestampPermalinkClick : undefined,
            onContextMenu: isLinked ? this.onTimestampContextMenu : undefined,
        };
    }

    private static getReactionGroupCount(reactions: Relations | null): number {
        if (!reactions || typeof reactions.getSortedAnnotationsByKey !== "function") {
            return 0;
        }

        return reactions.getSortedAnnotationsByKey()?.filter(([, events]) => events.size > 0).length ?? 0;
    }

    private updateChildViewModels(previousProps: EventTileViewModelProps, nextProps: EventTileViewModelProps): void {
        this.eventTileActionBarViewModel?.updateProps(
            EventTileViewModel.buildActionBarViewModelProps(
                nextProps,
                this.snapshot.current.interaction.isQuoteExpanded,
                this.onToggleThreadExpanded,
            ),
        );
        this.updateReactionsRowViewModel(nextProps);
        if (
            previousProps.mxEvent !== nextProps.mxEvent ||
            previousProps.senderMember !== nextProps.senderMember ||
            previousProps.senderUserStatus !== nextProps.senderUserStatus ||
            previousProps.timelineRenderingType !== nextProps.timelineRenderingType
        ) {
            this.eventTileDisambiguatedProfileViewModel.setProps(
                this.buildDisambiguatedProfileViewModelProps(nextProps),
            );
        }
        this.updateTimestampViewModel();
    }

    private updateReactionsRowViewModel(props: EventTileViewModelProps = this.props): void {
        const reactionsRowProps = EventTileViewModel.buildReactionsRowViewModelProps(props, this.reactions);

        this.eventTileReactionsRowViewModel.setActionable(reactionsRowProps.isActionable);
        this.eventTileReactionsRowViewModel.setCanReact(reactionsRowProps.canReact);
        this.eventTileReactionsRowViewModel.setReactionGroupCount(reactionsRowProps.reactionGroupCount);
    }

    private refreshReactions(props: EventTileViewModelProps = this.props): boolean {
        const reactions = EventTileViewModel.getReactions(props);
        if (this.reactions === reactions) return false;

        this.reactions = reactions;
        return true;
    }

    private updateTimestampViewModel(snapshot: EventTileViewSnapshot = this.snapshot.current): void {
        this.eventTileTimestampViewModel.setProps(this.buildTimestampViewModelProps(snapshot, this.props));
    }

    private static keepSnapshotGroup<T extends object>(current: T | undefined, next: T): T {
        if (!current) return next;

        const currentKeys = Object.keys(current) as Array<keyof T>;
        const nextKeys = Object.keys(next) as Array<keyof T>;
        if (currentKeys.length !== nextKeys.length) return next;

        return nextKeys.every((key) => Object.is(current[key], next[key])) ? current : next;
    }

    private static mergeSnapshotGroup<T extends object>(current: T, partial: Partial<T> | undefined): T | undefined {
        if (!partial) return undefined;

        return EventTileViewModel.keepSnapshotGroup(current, {
            ...current,
            ...partial,
        });
    }

    private static mergeSnapshotUpdate(
        current: EventTileViewSnapshot,
        partial: EventTileViewSnapshotUpdate,
    ): EventTileViewSnapshot {
        return {
            interaction:
                EventTileViewModel.mergeSnapshotGroup(current.interaction, partial.interaction) ?? current.interaction,
            receipt: EventTileViewModel.mergeSnapshotGroup(current.receipt, partial.receipt) ?? current.receipt,
            rendering: EventTileViewModel.mergeSnapshotGroup(current.rendering, partial.rendering) ?? current.rendering,
            timestamp: EventTileViewModel.mergeSnapshotGroup(current.timestamp, partial.timestamp) ?? current.timestamp,
            thread: EventTileViewModel.mergeSnapshotGroup(current.thread, partial.thread) ?? current.thread,
            sender: EventTileViewModel.mergeSnapshotGroup(current.sender, partial.sender) ?? current.sender,
            encryption:
                EventTileViewModel.mergeSnapshotGroup(current.encryption, partial.encryption) ?? current.encryption,
            presentation:
                EventTileViewModel.mergeSnapshotGroup(current.presentation, partial.presentation) ??
                current.presentation,
        };
    }

    /**
     * Builds the full tile view state from current props plus any listener-driven partial updates.
     * Merge order matters here: defaults are seeded first, then previous/partial state is preserved,
     * and finally the derived fields are recomputed from the latest props.
     */
    private static deriveSnapshot(
        props: EventTileViewModelProps,
        previousSnapshot?: EventTileViewSnapshot,
        partial: EventTileViewSnapshotUpdate = {},
        reactions: Relations | null = EventTileViewModel.getReactions(props),
    ): EventTileViewSnapshot {
        const baseSnapshot = EventTileViewModel.createBaseSnapshot(previousSnapshot, partial, props);
        const context = EventTileViewModel.createDerivationContext(props, baseSnapshot, reactions);
        const receiptSnapshot = EventTileViewModel.deriveReceiptSnapshot(props);
        const renderingSnapshot = EventTileViewModel.deriveRenderingSnapshot(props, context);
        const threadSnapshot = EventTileViewModel.deriveThreadSnapshot(props, context);
        const senderSnapshot = EventTileViewModel.deriveSenderSnapshot(props, context);
        const encryptionSnapshot = EventTileViewModel.deriveEncryptionSnapshot(props, context);
        const timestampSnapshot = EventTileViewModel.deriveTimestampSnapshot(props, baseSnapshot, context);
        const hasFooter = EventTileViewModel.getHasFooter(
            props.isRedacted,
            renderingSnapshot.isPinned,
            context.reactions,
        );

        const interaction = EventTileViewModel.keepSnapshotGroup(
            previousSnapshot?.interaction,
            baseSnapshot.interaction,
        );
        const receipt = EventTileViewModel.keepSnapshotGroup(previousSnapshot?.receipt, receiptSnapshot);
        const timestamp = EventTileViewModel.keepSnapshotGroup(previousSnapshot?.timestamp, timestampSnapshot);
        const thread = EventTileViewModel.keepSnapshotGroup(previousSnapshot?.thread, threadSnapshot);
        const sender = EventTileViewModel.keepSnapshotGroup(previousSnapshot?.sender, senderSnapshot);
        const encryptionSnapshotWithTitleBase: EventTileEncryptionSnapshot = {
            ...encryptionSnapshot,
            encryptionIndicatorTitle: undefined,
        };
        const renderingSnapshotWithFooter: EventTileRenderingSnapshot = {
            ...renderingSnapshot,
            hasFooter,
        };
        const preActionBarSnapshot: EventTileViewSnapshot = {
            interaction,
            receipt,
            rendering: renderingSnapshotWithFooter,
            timestamp,
            thread,
            sender,
            encryption: encryptionSnapshotWithTitleBase,
            presentation: baseSnapshot.presentation,
        };

        const rendering = EventTileViewModel.keepSnapshotGroup(previousSnapshot?.rendering, {
            ...renderingSnapshotWithFooter,
            shouldRenderActionBar: EventTileViewModel.getShouldRenderActionBar(props, preActionBarSnapshot),
        });
        const snapshotWithoutPresentation: EventTileViewSnapshot = {
            ...preActionBarSnapshot,
            rendering,
        };
        const encryptionIndicatorTitle = EventTileViewModel.getEncryptionIndicatorTitle(
            props,
            snapshotWithoutPresentation,
            encryptionSnapshot.isEncryptionFailure,
        );
        const encryption = EventTileViewModel.keepSnapshotGroup(previousSnapshot?.encryption, {
            ...encryptionSnapshot,
            encryptionIndicatorTitle,
        });
        const snapshotForPresentation: EventTileViewSnapshot = {
            ...snapshotWithoutPresentation,
            encryption,
        };
        const presentation = EventTileViewModel.keepSnapshotGroup(previousSnapshot?.presentation, {
            eventId: EventTileViewModel.getEventId(props),
            ariaLive: EventTileViewModel.getAriaLive(props),
            rootClassName: EventTileViewModel.getRootClassName(props, snapshotForPresentation),
            contentClassName: EventTileViewModel.getContentClassName(props.mxEvent),
            isNotification: EventTileViewModel.getIsNotification(props),
            isListLikeTile: EventTileViewModel.getIsListLikeTile(props),
            notificationRoomName: EventTileViewModel.getNotificationRoomName(props),
            shouldRenderMissingRendererFallback: rendering.renderMode === EventTileRenderMode.MissingRendererFallback,
        });

        return {
            ...snapshotForPresentation,
            presentation,
        };
    }

    private static createBaseSnapshot(
        previousSnapshot: EventTileViewSnapshot | undefined,
        partial: EventTileViewSnapshotUpdate,
        props: EventTileViewModelProps,
    ): EventTileViewSnapshot {
        return EventTileViewModel.mergeSnapshotUpdate(
            previousSnapshot ?? EventTileViewModel.createDefaultSnapshot(props),
            partial,
        );
    }

    private static createDefaultSnapshot(props: EventTileViewModelProps): EventTileViewSnapshot {
        return {
            interaction: {
                actionBarFocused: false,
                hover: false,
                focusWithin: false,
                showActionBarFromFocus: false,
                isContextMenuOpen: false,
                contextMenuState: undefined,
                isQuoteExpanded: undefined,
            },
            receipt: {
                shouldShowSentReceipt: false,
                shouldShowSendingReceipt: false,
                showReadReceipts: false,
            },
            rendering: {
                isHighlighted: false,
                isContinuation: false,
                isSending: false,
                isEditing: false,
                showReplyPreview: false,
                shouldRenderReplyPreview: false,
                shouldRenderActionBar: false,
                renderMode: EventTileRenderMode.Rendered,
                hasRenderer: false,
                tileRenderType: props.timelineRenderingType,
                isBubbleMessage: false,
                isInfoMessage: false,
                isLeftAlignedBubbleMessage: false,
                noBubbleEvent: false,
                isSeeingThroughMessageHiddenForModeration: false,
                isPinned: false,
                hasFooter: false,
            },
            timestamp: {
                showTimestamp: false,
                permalink: "#",
                scrollToken: undefined,
                timestampDisplayMode: TimestampDisplayMode.Hidden,
                timestampFormatMode: TimestampFormatMode.Absolute,
                timestampTs: props.mxEvent.getTs(),
                receivedTs: undefined,
            },
            thread: {
                thread: null,
                threadUpdateKey: "",
                threadNotification: undefined,
                hasThread: false,
                isThreadRoot: false,
                threadPanelMode: ThreadPanelMode.None,
                threadInfoMode: ThreadInfoMode.None,
                threadInfoHref: undefined,
                threadInfoLabel: undefined,
                threadReplyCount: undefined,
                shouldRenderThreadPreview: false,
                shouldRenderThreadToolbar: false,
                tileClickMode: ClickMode.None,
                openedFromSearch: false,
            },
            sender: {
                isOwnEvent: false,
                showSender: false,
                showSenderProfile: false,
                avatarSubject: AvatarSubject.None,
                avatarSize: AvatarSize.None,
                avatarMemberUserOnClick: false,
                avatarForceHistorical: false,
                senderMode: SenderMode.Hidden,
            },
            encryption: {
                shieldColour: EventShieldColour.NONE,
                shieldReason: null,
                isEncryptionFailure: false,
                padlockMode: PadlockMode.None,
                encryptionIndicatorMode: EncryptionIndicatorMode.None,
                sharedKeysUserId: undefined,
                sharedKeysRoomId: undefined,
                encryptionIndicatorTitle: undefined,
            },
            presentation: {
                eventId: undefined,
                ariaLive: "off",
                rootClassName: "mx_EventTile",
                contentClassName: "mx_EventTile_line",
                isNotification: false,
                isListLikeTile: false,
                notificationRoomName: undefined,
                shouldRenderMissingRendererFallback: false,
            },
        };
    }

    private static deriveReceiptSnapshot(props: EventTileViewModelProps): EventTileReceiptSnapshot {
        const shouldShowSentReceipt = EventTileViewModel.getShouldShowSentReceipt(props);
        const shouldShowSendingReceipt = EventTileViewModel.getShouldShowSendingReceipt(props);

        return {
            shouldShowSentReceipt,
            shouldShowSendingReceipt,
            showReadReceipts: EventTileViewModel.getShowReadReceipts(props, {
                shouldShowSentReceipt,
                shouldShowSendingReceipt,
            }),
        };
    }

    private static deriveRenderingSnapshot(
        props: EventTileViewModelProps,
        context: EventTileDerivationContext,
    ): EventTileRenderingSnapshot {
        const showReplyPreview = EventTileViewModel.getShowReplyPreview(props);
        const hasRenderer = context.displayInfo.hasRenderer;

        return {
            isHighlighted: EventTileViewModel.getShouldHighlight(props),
            isContinuation: EventTileViewModel.getIsContinuation(props),
            isSending: EventTileViewModel.getIsSending(props),
            isEditing: EventTileViewModel.getIsEditing(props),
            showReplyPreview,
            shouldRenderReplyPreview: EventTileViewModel.getShouldRenderReplyPreview(showReplyPreview, hasRenderer),
            shouldRenderActionBar: false,
            renderMode: EventTileViewModel.getRenderMode(props, hasRenderer),
            hasRenderer,
            tileRenderType: EventTileViewModel.getTileRenderType(props),
            isBubbleMessage: context.displayInfo.isBubbleMessage,
            isInfoMessage: context.displayInfo.isInfoMessage,
            isLeftAlignedBubbleMessage: context.displayInfo.isLeftAlignedBubbleMessage,
            noBubbleEvent: context.displayInfo.noBubbleEvent,
            isSeeingThroughMessageHiddenForModeration: context.displayInfo.isSeeingThroughMessageHiddenForModeration,
            isPinned: EventTileViewModel.getIsPinned(props),
            hasFooter: false,
        };
    }

    private static deriveTimestampSnapshot(
        props: EventTileViewModelProps,
        baseSnapshot: EventTileViewSnapshot,
        context: EventTileDerivationContext,
    ): EventTileTimestampSnapshot {
        const timestampSnapshot: EventTileTimestampSnapshot = {
            showTimestamp: context.showTimestamp,
            permalink: EventTileViewModel.getPermalink(props),
            scrollToken: EventTileViewModel.getScrollToken(props),
            timestampDisplayMode: EventTileViewModel.getTimestampDisplayMode(props, context.showTimestamp),
            timestampFormatMode: EventTileViewModel.getTimestampFormatMode(props),
            timestampTs: props.mxEvent.getTs(),
            receivedTs: EventTileViewModel.getReceivedTs(props),
        };

        timestampSnapshot.timestampTs = EventTileViewModel.getTimestampTs(props, context.thread);

        return timestampSnapshot;
    }

    private static deriveThreadSnapshot(
        props: EventTileViewModelProps,
        context: EventTileDerivationContext,
    ): EventTileThreadSnapshot {
        return {
            thread: context.thread,
            threadUpdateKey: EventTileViewModel.getThreadUpdateKey(context.thread),
            threadNotification: context.threadNotification,
            hasThread: context.hasThread,
            isThreadRoot: context.isThreadRoot,
            threadPanelMode: EventTileViewModel.getThreadPanelMode(props, context.thread),
            threadInfoMode: EventTileViewModel.getThreadInfoMode(props, context.isThreadRoot, context.thread),
            threadInfoHref: EventTileViewModel.getThreadInfoHref(props),
            threadInfoLabel: EventTileViewModel.getThreadInfoLabel(props),
            threadReplyCount: EventTileViewModel.getThreadReplyCount(props, context.thread),
            shouldRenderThreadPreview: EventTileViewModel.getShouldRenderThreadPreview(props, context.thread),
            shouldRenderThreadToolbar: EventTileViewModel.getShouldRenderThreadToolbar(props, context.thread),
            tileClickMode: EventTileViewModel.getTileClickMode(props),
            openedFromSearch: EventTileViewModel.getOpenedFromSearch(props),
        };
    }

    private static deriveSenderSnapshot(
        props: EventTileViewModelProps,
        context: EventTileDerivationContext,
    ): EventTileSenderSnapshot {
        const senderMode = EventTileViewModel.getSenderMode(props, context.showSender, context.senderPresentation);

        return {
            isOwnEvent: EventTileViewModel.getIsOwnEvent(props),
            showSender: context.showSender,
            showSenderProfile: EventTileViewModel.getShouldRenderSenderProfile(props, senderMode),
            avatarSubject: EventTileViewModel.getAvatarSubject(props, context.senderPresentation.avatarSize),
            avatarSize: context.senderPresentation.avatarSize,
            avatarMemberUserOnClick: EventTileViewModel.getAvatarMemberUserOnClick(
                props,
                context.senderPresentation.avatarSize,
            ),
            avatarForceHistorical: EventTileViewModel.getAvatarForceHistorical(props),
            senderMode,
        };
    }

    private static deriveEncryptionSnapshot(
        props: EventTileViewModelProps,
        context: EventTileDerivationContext,
    ): EventTileEncryptionSnapshot {
        const event = props.mxEvent.replacingEvent() ?? props.mxEvent;
        const encryptionIndicatorMode = EventTileViewModel.getEncryptionIndicatorMode(
            props,
            context.isEncryptionFailure,
            context.shieldColour,
            context.shieldReason,
        );

        return {
            shieldColour: context.shieldColour,
            shieldReason: context.shieldReason,
            isEncryptionFailure: context.isEncryptionFailure,
            padlockMode: EventTileViewModel.getPadlockMode(props, context.displayInfo.isBubbleMessage),
            encryptionIndicatorMode,
            sharedKeysUserId: EventTileViewModel.getSharedKeysUserId(
                props,
                event,
                context.isEncryptionFailure,
                context.shieldReason,
            ),
            sharedKeysRoomId: EventTileViewModel.getSharedKeysRoomId(
                event,
                context.isEncryptionFailure,
                context.shieldReason,
            ),
        };
    }

    private static createDerivationContext(
        props: EventTileViewModelProps,
        baseSnapshot: EventTileViewSnapshot,
        reactions: Relations | null,
    ): EventTileDerivationContext {
        const displayInfo = EventTileViewModel.getDisplayInfo(props);
        const thread = baseSnapshot.thread.thread ?? EventTileViewModel.getThread(props);
        const showSender = EventTileViewModel.getShowSender(props);
        const senderPresentation = EventTileViewModel.getSenderPresentationContext(
            props,
            displayInfo.isInfoMessage,
            displayInfo.isBubbleMessage,
        );

        return {
            displayInfo,
            shieldColour: baseSnapshot.encryption.shieldColour,
            shieldReason: baseSnapshot.encryption.shieldReason,
            reactions,
            thread,
            threadNotification: baseSnapshot.thread.threadNotification,
            hasThread: Boolean(thread),
            isThreadRoot: thread?.id === props.mxEvent.getId(),
            showSender,
            senderPresentation,
            isEncryptionFailure: EventTileViewModel.getIsEncryptionFailure(props),
            showTimestamp: EventTileViewModel.getShowTimestamp(props, baseSnapshot),
        };
    }

    private static deriveInteractionDependentSnapshot(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): EventTileViewSnapshotUpdate {
        const showTimestamp = EventTileViewModel.getShowTimestamp(props, snapshot);
        const timestampDisplayMode = EventTileViewModel.getTimestampDisplayMode(props, showTimestamp);
        const nextTimestamp: EventTileTimestampSnapshot = {
            ...snapshot.timestamp,
            showTimestamp,
            timestampDisplayMode,
        };
        const nextSnapshot: EventTileViewSnapshot = {
            ...snapshot,
            timestamp: nextTimestamp,
        };
        const update: EventTileViewSnapshotUpdate = {
            timestamp: {
                showTimestamp,
                timestampDisplayMode,
            },
            rendering: {
                shouldRenderActionBar: EventTileViewModel.getShouldRenderActionBar(props, nextSnapshot),
            },
        };

        return update;
    }

    private static getDisplayInfo(props: EventTileViewModelProps): ReturnType<typeof getEventDisplayInfo> {
        return getEventDisplayInfo(props.cli, props.mxEvent, props.showHiddenEvents, this.shouldHideEvent(props));
    }

    private static getRoom(props: EventTileViewModelProps): Room | null {
        const roomId = props.mxEvent.getRoomId();
        return roomId ? props.cli.getRoom(roomId) : null;
    }

    private static shouldHideEvent(props: EventTileViewModelProps): boolean {
        return props.callEventGrouper?.hangupReason === CallErrorCode.Replaced;
    }

    private static getReactions(props: EventTileViewModelProps): Relations | null {
        if (!props.showReactions || !props.getRelationsForEvent) {
            return null;
        }

        const eventId = props.mxEvent.getId();
        if (!eventId) {
            return null;
        }

        return props.getRelationsForEvent(eventId, "m.annotation", "m.reaction") ?? null;
    }

    private static shouldRefreshReactions(
        previousProps: EventTileViewModelProps,
        nextProps: EventTileViewModelProps,
    ): boolean {
        return (
            previousProps.mxEvent !== nextProps.mxEvent ||
            previousProps.showReactions !== nextProps.showReactions ||
            previousProps.getRelationsForEvent !== nextProps.getRelationsForEvent
        );
    }

    private static isEligibleForSpecialReceipt(props: EventTileViewModelProps): boolean {
        // "Special" receipts are the custom sent/sending indicators for the current user's own message,
        // used when there are no explicit read receipts to show instead.
        if (props.readReceipts && props.readReceipts.length > 0) return false;

        const roomId = props.mxEvent.getRoomId();
        const room = roomId ? props.cli.getRoom(roomId) : null;
        if (!room) return false;

        const myUserId = props.cli.getUserId();
        if (!myUserId || props.mxEvent.getSender() !== myUserId) return false;

        if (!isMessageEvent(props.mxEvent) && props.mxEvent.getType() !== EventType.RoomMessageEncrypted) return false;

        return true;
    }

    private static getShouldShowSentReceipt(props: EventTileViewModelProps): boolean {
        // Show the custom "sent" receipt only for the current user's most recent eligible message.
        if (!this.isEligibleForSpecialReceipt(props)) return false;
        if (!props.lastSuccessful) return false;
        if (props.timelineRenderingType === TimelineRenderingType.ThreadsList) return false;
        if (props.eventSendStatus && props.eventSendStatus !== EventStatus.SENT) return false;

        const receipts = props.readReceipts || [];
        const myUserId = props.cli.getUserId();
        if (receipts.some((receipt) => receipt.userId !== myUserId)) return false;

        return true;
    }

    private static getShouldShowSendingReceipt(props: EventTileViewModelProps): boolean {
        // Show the custom "sending" receipt while that same eligible message is still pending send.
        if (!this.isEligibleForSpecialReceipt(props)) return false;
        if (!props.eventSendStatus || props.eventSendStatus === EventStatus.SENT) return false;
        return true;
    }

    private static getShowReadReceipts(
        props: EventTileViewModelProps,
        receiptState: Pick<EventTileReceiptSnapshot, "shouldShowSentReceipt" | "shouldShowSendingReceipt">,
    ): boolean {
        return (
            !receiptState.shouldShowSentReceipt &&
            !receiptState.shouldShowSendingReceipt &&
            Boolean(props.showReadReceipts)
        );
    }

    private static getShouldHighlight(props: EventTileViewModelProps): boolean {
        if (props.forExport) return false;
        if (props.timelineRenderingType === TimelineRenderingType.Notification) return false;
        if (props.timelineRenderingType === TimelineRenderingType.ThreadsList) return false;
        if (props.isRedacted) return false;

        const actions = props.cli.getPushActionsForEvent(props.mxEvent.replacingEvent() || props.mxEvent);
        const previousActions = props.mxEvent.replacingEvent()
            ? props.cli.getPushActionsForEvent(props.mxEvent)
            : undefined;

        if (!actions?.tweaks && !previousActions?.tweaks) {
            return false;
        }

        if (props.mxEvent.getSender() === props.cli.credentials.userId) {
            return false;
        }

        return !!(actions?.tweaks.highlight || previousActions?.tweaks.highlight);
    }

    private static getIsContinuation(props: EventTileViewModelProps): boolean {
        // Continuation layout is only meaningful in views that visually group adjacent events.
        if (
            props.timelineRenderingType !== TimelineRenderingType.Room &&
            props.timelineRenderingType !== TimelineRenderingType.Search &&
            props.timelineRenderingType !== TimelineRenderingType.Thread &&
            props.layout !== Layout.Bubble
        ) {
            return false;
        }

        return Boolean(props.continuation);
    }

    private static getShowReplyPreview(props: EventTileViewModelProps): boolean {
        return !this.shouldHideEvent(props) && shouldDisplayReply(props.mxEvent);
    }

    private static getShouldRenderReplyPreview(showReplyPreview: boolean, hasRenderer: boolean): boolean {
        return showReplyPreview && hasRenderer;
    }

    private static getRenderMode(props: EventTileViewModelProps, hasRenderer: boolean): EventTileRenderMode {
        if (!hasRenderer && props.timelineRenderingType !== TimelineRenderingType.Notification) {
            return EventTileRenderMode.MissingRendererFallback;
        }

        return EventTileRenderMode.Rendered;
    }

    private static getTileRenderType(props: EventTileViewModelProps): TimelineRenderingType {
        if (props.timelineRenderingType === TimelineRenderingType.Thread) {
            return TimelineRenderingType.Thread;
        }

        if (props.timelineRenderingType === TimelineRenderingType.File) {
            return TimelineRenderingType.File;
        }

        return props.timelineRenderingType;
    }

    private static getIsSending(props: EventTileViewModelProps): boolean {
        return (
            !!props.eventSendStatus &&
            [EventStatus.SENDING, EventStatus.QUEUED, EventStatus.ENCRYPTING].includes(props.eventSendStatus)
        );
    }

    private static getIsEditing(props: EventTileViewModelProps): boolean {
        return Boolean(props.editState);
    }

    private static getIsPinned(props: EventTileViewModelProps): boolean {
        return PinningUtils.isPinned(props.cli, props.mxEvent);
    }

    private static getHasFooter(
        isRedacted: boolean | undefined,
        isPinned: boolean,
        reactions: Relations | null,
    ): boolean {
        return isPinned || (!isRedacted && !!reactions);
    }

    private static getShouldRenderActionBar(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return (
            !snapshot.rendering.isEditing &&
            !props.forExport &&
            (snapshot.interaction.hover ||
                snapshot.interaction.showActionBarFromFocus ||
                (snapshot.interaction.actionBarFocused && !snapshot.interaction.isContextMenuOpen))
        );
    }

    private static getPermalink(props: EventTileViewModelProps): string {
        const eventId = props.mxEvent.getId();
        if (!props.permalinkCreator || !eventId) return "#";
        return props.permalinkCreator.forEvent(eventId);
    }

    private static getEventId(props: EventTileViewModelProps): string | undefined {
        return props.mxEvent.getId() ?? undefined;
    }

    private static getAriaLive(props: EventTileViewModelProps): "off" | undefined {
        return props.eventSendStatus === null ? undefined : "off";
    }

    private static getScrollToken(props: EventTileViewModelProps): string | undefined {
        return props.mxEvent.status ? undefined : (props.mxEvent.getId() ?? undefined);
    }

    private static getReceivedTs(props: EventTileViewModelProps): number | undefined {
        return getLateEventInfo(props.mxEvent)?.received_ts;
    }

    private static getShowTimestamp(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return Boolean(
            props.mxEvent.getTs() &&
            !props.hideTimestamp &&
            (props.alwaysShowTimestamps ||
                props.last ||
                snapshot.interaction.hover ||
                snapshot.interaction.focusWithin ||
                snapshot.interaction.actionBarFocused ||
                snapshot.interaction.isContextMenuOpen),
        );
    }

    private static getTimestampDisplayMode(
        props: EventTileViewModelProps,
        showTimestamp: boolean,
    ): TimestampDisplayMode {
        if (!showTimestamp) {
            return props.layout === Layout.IRC ? TimestampDisplayMode.Placeholder : TimestampDisplayMode.Hidden;
        }

        return props.timelineRenderingType === TimelineRenderingType.Notification ||
            props.timelineRenderingType === TimelineRenderingType.File ||
            props.timelineRenderingType === TimelineRenderingType.ThreadsList
            ? TimestampDisplayMode.Plain
            : TimestampDisplayMode.Linked;
    }

    private static getTimestampFormatMode(props: EventTileViewModelProps): TimestampFormatMode {
        return props.timelineRenderingType === TimelineRenderingType.ThreadsList
            ? TimestampFormatMode.Relative
            : TimestampFormatMode.Absolute;
    }

    private static getTimestampTs(props: EventTileViewModelProps, thread: Thread | null): number {
        if (props.timelineRenderingType !== TimelineRenderingType.ThreadsList) {
            return props.mxEvent.getTs();
        }

        return thread?.replyToEvent?.getTs() ?? props.mxEvent.getTs();
    }

    private static getThread(props: EventTileViewModelProps): Thread | null {
        // Thread lookup can lag behind event creation, so try both the event-attached thread and the room index.
        let thread = props.mxEvent.getThread() ?? undefined;
        if (!thread) {
            const roomId = props.mxEvent.getRoomId();
            const room = roomId ? props.cli.getRoom(roomId) : null;
            thread = room?.findThreadForEvent(props.mxEvent) ?? undefined;
        }
        return thread ?? null;
    }

    private static getRoomThreadListenerEventId(props: EventTileViewModelProps): string | null {
        if (EventTileViewModel.getThread(props)) {
            return null;
        }

        return props.mxEvent.getId() ?? null;
    }

    private static getThreadUpdateKey(thread: Thread | null): string {
        if (!thread) return "";

        return `${thread.id}:${thread.length}:${thread.replyToEvent?.getId() ?? ""}`;
    }

    private static getThreadPanelMode(props: EventTileViewModelProps, thread: Thread | null): ThreadPanelMode {
        const showsToolbar = props.timelineRenderingType === TimelineRenderingType.ThreadsList;
        const showsSummary =
            (props.timelineRenderingType === TimelineRenderingType.Notification ||
                props.timelineRenderingType === TimelineRenderingType.ThreadsList) &&
            Boolean(thread);

        if (showsToolbar && showsSummary) {
            return ThreadPanelMode.SummaryWithToolbar;
        }
        if (showsToolbar) {
            return ThreadPanelMode.Toolbar;
        }
        if (showsSummary) {
            return ThreadPanelMode.Summary;
        }

        return ThreadPanelMode.None;
    }

    private static getThreadInfoMode(
        props: EventTileViewModelProps,
        isThreadRoot: boolean,
        thread: Thread | null,
    ): ThreadInfoMode {
        if (isThreadRoot && thread) {
            return ThreadInfoMode.Summary;
        }

        if (props.timelineRenderingType === TimelineRenderingType.Search && props.mxEvent.threadRootId) {
            return props.highlightLink ? ThreadInfoMode.SearchLink : ThreadInfoMode.SearchText;
        }

        return ThreadInfoMode.None;
    }

    private static getThreadInfoHref(props: EventTileViewModelProps): string | undefined {
        return props.timelineRenderingType === TimelineRenderingType.Search ? props.highlightLink : undefined;
    }

    private static getThreadInfoLabel(props: EventTileViewModelProps): string | undefined {
        return props.timelineRenderingType === TimelineRenderingType.Search
            ? _t("timeline|thread_info_basic")
            : undefined;
    }

    private static getThreadReplyCount(props: EventTileViewModelProps, thread: Thread | null): number | undefined {
        const threadPanelMode = EventTileViewModel.getThreadPanelMode(props, thread);
        if (
            (threadPanelMode === ThreadPanelMode.Summary || threadPanelMode === ThreadPanelMode.SummaryWithToolbar) &&
            thread
        ) {
            return thread.length;
        }

        return undefined;
    }

    private static getShouldRenderThreadPreview(props: EventTileViewModelProps, thread: Thread | null): boolean {
        const threadPanelMode = EventTileViewModel.getThreadPanelMode(props, thread);
        return (
            (threadPanelMode === ThreadPanelMode.Summary || threadPanelMode === ThreadPanelMode.SummaryWithToolbar) &&
            Boolean(thread)
        );
    }

    private static getShouldRenderThreadToolbar(props: EventTileViewModelProps, thread: Thread | null): boolean {
        const threadPanelMode = EventTileViewModel.getThreadPanelMode(props, thread);
        return threadPanelMode === ThreadPanelMode.Toolbar || threadPanelMode === ThreadPanelMode.SummaryWithToolbar;
    }

    private static getTileClickMode(props: EventTileViewModelProps): ClickMode {
        switch (props.timelineRenderingType) {
            case TimelineRenderingType.Notification:
                return ClickMode.ViewRoom;
            case TimelineRenderingType.ThreadsList:
                return ClickMode.ShowThread;
            default:
                return ClickMode.None;
        }
    }

    private static getOpenedFromSearch(props: EventTileViewModelProps): boolean {
        return props.timelineRenderingType === TimelineRenderingType.Search;
    }

    private static getIsNotification(props: EventTileViewModelProps): boolean {
        return props.timelineRenderingType === TimelineRenderingType.Notification;
    }

    private static getIsListLikeTile(props: EventTileViewModelProps): boolean {
        return (
            props.timelineRenderingType === TimelineRenderingType.Notification ||
            props.timelineRenderingType === TimelineRenderingType.ThreadsList
        );
    }

    private static getNotificationRoomName(props: EventTileViewModelProps): string | undefined {
        return EventTileViewModel.getRoom(props)?.name;
    }

    private static getShowSender(props: EventTileViewModelProps): boolean {
        return !props.hideSender;
    }

    private static getSenderPresentationContext(
        props: EventTileViewModelProps,
        isInfoMessage: boolean,
        isBubbleMessage: boolean,
    ): EventTileSenderPresentationContext {
        // Sender presentation is classified once here so avatar size and sender-profile rules stay aligned.
        const eventType = props.mxEvent.getType();

        if (props.timelineRenderingType === TimelineRenderingType.Notification) {
            return {
                avatarSize: AvatarSize.Medium,
                needsSenderProfile: true,
            };
        }

        if (isInfoMessage) {
            return {
                avatarSize: AvatarSize.XSmall,
                needsSenderProfile: false,
            };
        }

        if (
            props.timelineRenderingType === TimelineRenderingType.ThreadsList ||
            (props.timelineRenderingType === TimelineRenderingType.Thread && !props.continuation)
        ) {
            return {
                avatarSize: AvatarSize.XLarge,
                needsSenderProfile: true,
            };
        }

        if (eventType === EventType.RoomCreate || isBubbleMessage) {
            return {
                avatarSize: AvatarSize.None,
                needsSenderProfile: false,
            };
        }

        if (props.layout === Layout.IRC) {
            return {
                avatarSize: AvatarSize.XSmall,
                needsSenderProfile: true,
            };
        }

        if (
            (props.continuation && props.timelineRenderingType !== TimelineRenderingType.File) ||
            eventType === EventType.CallInvite ||
            ElementCallEventType.matches(eventType)
        ) {
            return {
                avatarSize: AvatarSize.None,
                needsSenderProfile: false,
            };
        }

        if (props.timelineRenderingType === TimelineRenderingType.File) {
            return {
                avatarSize: AvatarSize.Small,
                needsSenderProfile: true,
            };
        }

        return {
            avatarSize: AvatarSize.Large,
            needsSenderProfile: true,
        };
    }

    private static getAvatarSubject(props: EventTileViewModelProps, avatarSize: AvatarSize): AvatarSubject {
        if (avatarSize === AvatarSize.None) {
            return AvatarSubject.None;
        }

        return props.mxEvent.getContent().third_party_invite ? AvatarSubject.Target : AvatarSubject.Sender;
    }

    private static getAvatarMemberUserOnClick(props: EventTileViewModelProps, avatarSize: AvatarSize): boolean {
        if (avatarSize === AvatarSize.None) return false;
        if (props.inhibitInteraction) return false;

        return ![TimelineRenderingType.ThreadsList, TimelineRenderingType.Notification].includes(
            props.timelineRenderingType,
        );
    }

    private static getAvatarForceHistorical(props: EventTileViewModelProps): boolean {
        return props.mxEvent.getType() === EventType.RoomMember;
    }

    private static getSenderMode(
        props: EventTileViewModelProps,
        showSender: boolean,
        senderPresentation: EventTileSenderPresentationContext,
    ): SenderMode {
        if (!showSender || !senderPresentation.needsSenderProfile) {
            return SenderMode.Hidden;
        }

        switch (props.timelineRenderingType) {
            case TimelineRenderingType.Room:
            case TimelineRenderingType.Search:
            case TimelineRenderingType.Pinned:
            case TimelineRenderingType.Thread:
                return SenderMode.ComposerInsert;
            case TimelineRenderingType.ThreadsList:
                return SenderMode.Tooltip;
            default:
                return SenderMode.Default;
        }
    }

    private static getShouldRenderSenderProfile(props: EventTileViewModelProps, senderMode: SenderMode): boolean {
        return senderMode !== SenderMode.Hidden && props.mxEvent.getContent().msgtype !== MsgType.Emote;
    }

    private static getSenderProfileMode(props: EventTileViewModelProps): SenderMode {
        switch (props.timelineRenderingType) {
            case TimelineRenderingType.Room:
            case TimelineRenderingType.Search:
            case TimelineRenderingType.Pinned:
            case TimelineRenderingType.Thread:
                return SenderMode.ComposerInsert;
            case TimelineRenderingType.ThreadsList:
                return SenderMode.Tooltip;
            default:
                return SenderMode.Default;
        }
    }

    private static getIsOwnEvent(props: EventTileViewModelProps): boolean {
        return props.mxEvent.getSender() === props.cli.getUserId();
    }

    private static getIsEncryptionFailure(props: EventTileViewModelProps): boolean {
        return props.mxEvent.isDecryptionFailure();
    }

    private static getPadlockMode(props: EventTileViewModelProps, isBubbleMessage: boolean): PadlockMode {
        if (isBubbleMessage) return PadlockMode.None;
        return props.layout === Layout.IRC ? PadlockMode.Irc : PadlockMode.Group;
    }

    private static getEncryptionIndicatorMode(
        props: EventTileViewModelProps,
        isEncryptionFailure: boolean,
        shieldColour: EventShieldColour,
        shieldReason: EventShieldReason | null,
    ): EncryptionIndicatorMode {
        // Collapse crypto and shield state into the UI-level indicator the tile should render.
        const event = props.mxEvent.replacingEvent() ?? props.mxEvent;

        if (isLocalRoom(event.getRoomId())) return EncryptionIndicatorMode.None;

        if (isEncryptionFailure) {
            return EventTileViewModel.getDecryptionFailureIndicatorMode(event.decryptionFailureReason);
        }

        if (shieldReason === EventShieldReason.AUTHENTICITY_NOT_GUARANTEED && props.mxEvent.getKeyForwardingUser()) {
            return EncryptionIndicatorMode.None;
        }

        if (shieldColour !== EventShieldColour.NONE) {
            return shieldColour === EventShieldColour.GREY
                ? EncryptionIndicatorMode.Normal
                : EncryptionIndicatorMode.Warning;
        }

        if (!props.isRoomEncrypted || EventTileViewModel.shouldSuppressRoomEncryptionIndicator(event)) {
            return EncryptionIndicatorMode.None;
        }

        return event.isEncrypted() ? EncryptionIndicatorMode.None : EncryptionIndicatorMode.Warning;
    }

    private static getEncryptionIndicatorTitle(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
        isEncryptionFailure: boolean,
    ): string | undefined {
        const event = props.mxEvent.replacingEvent() ?? props.mxEvent;

        if (isEncryptionFailure) {
            switch (event.decryptionFailureReason) {
                case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
                case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                    return undefined;
                default:
                    return _t("timeline|undecryptable_tooltip");
            }
        }

        if (snapshot.encryption.shieldColour !== EventShieldColour.NONE) {
            switch (snapshot.encryption.shieldReason) {
                case EventShieldReason.UNVERIFIED_IDENTITY:
                    return _t("encryption|event_shield_reason_unverified_identity");
                case EventShieldReason.UNSIGNED_DEVICE:
                    return _t("encryption|event_shield_reason_unsigned_device");
                case EventShieldReason.UNKNOWN_DEVICE:
                    return _t("encryption|event_shield_reason_unknown_device");
                case EventShieldReason.AUTHENTICITY_NOT_GUARANTEED:
                    return _t("encryption|event_shield_reason_authenticity_not_guaranteed");
                case EventShieldReason.MISMATCHED_SENDER_KEY:
                    return _t("encryption|event_shield_reason_mismatched_sender_key");
                case EventShieldReason.SENT_IN_CLEAR:
                    return _t("common|unencrypted");
                case EventShieldReason.VERIFICATION_VIOLATION:
                    return _t("timeline|decryption_failure|sender_identity_previously_verified");
                case EventShieldReason.MISMATCHED_SENDER:
                    return _t("encryption|event_shield_reason_mismatched_sender");
                default:
                    return _t("error|unknown");
            }
        }

        if (props.isRoomEncrypted && !event.isEncrypted() && !event.isState() && !event.isRedacted()) {
            if (event.status === EventStatus.ENCRYPTING) return undefined;
            if (event.status === EventStatus.NOT_SENT) return undefined;
            return _t("common|unencrypted");
        }

        return undefined;
    }

    private static getContentClassName(mxEvent: MatrixEvent): string {
        const isProbablyMedia = TileMediaEventHelper.isEligible(mxEvent);

        return classNames("mx_EventTile_line", {
            mx_EventTile_mediaLine: isProbablyMedia,
            mx_EventTile_image:
                mxEvent.getType() === EventType.RoomMessage && mxEvent.getContent().msgtype === MsgType.Image,
            mx_EventTile_sticker: mxEvent.getType() === EventType.Sticker,
            mx_EventTile_emote:
                mxEvent.getType() === EventType.RoomMessage && mxEvent.getContent().msgtype === MsgType.Emote,
        });
    }

    private static getRootClassName(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): string {
        const eventType = props.mxEvent.getType();
        const msgtype = props.mxEvent.getContent().msgtype;
        const isNotification = EventTileViewModel.getIsNotification(props);

        return classNames({
            mx_EventTile_bubbleContainer: snapshot.rendering.isBubbleMessage,
            mx_EventTile_leftAlignedBubble: snapshot.rendering.isLeftAlignedBubbleMessage,
            mx_EventTile: true,
            mx_EventTile_isEditing: snapshot.rendering.isEditing,
            mx_EventTile_info: snapshot.rendering.isInfoMessage,
            mx_EventTile_12hr: props.isTwelveHour,
            mx_EventTile_sending: !snapshot.rendering.isEditing && snapshot.rendering.isSending,
            mx_EventTile_highlight: snapshot.rendering.isHighlighted,
            mx_EventTile_selected: props.isSelectedEvent || snapshot.interaction.isContextMenuOpen,
            mx_EventTile_continuation:
                snapshot.rendering.isContinuation ||
                eventType === EventType.CallInvite ||
                ElementCallEventType.matches(eventType),
            mx_EventTile_last: props.last,
            mx_EventTile_lastInSection: props.lastInSection,
            mx_EventTile_contextual: props.contextual,
            mx_EventTile_actionBarFocused: snapshot.interaction.actionBarFocused,
            mx_EventTile_bad: snapshot.encryption.isEncryptionFailure,
            mx_EventTile_emote: msgtype === MsgType.Emote,
            mx_EventTile_noSender: !snapshot.sender.showSender,
            mx_EventTile_clamp: props.timelineRenderingType === TimelineRenderingType.ThreadsList || isNotification,
            mx_EventTile_noBubble: snapshot.rendering.noBubbleEvent,
        });
    }

    private static getDecryptionFailureIndicatorMode(
        reason: DecryptionFailureCode | null | undefined,
    ): EncryptionIndicatorMode {
        switch (reason) {
            case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
            case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                return EncryptionIndicatorMode.None;
            default:
                return EncryptionIndicatorMode.DecryptionFailure;
        }
    }

    private static shouldSuppressRoomEncryptionIndicator(event: MatrixEvent): boolean {
        return (
            event.status === EventStatus.ENCRYPTING ||
            event.status === EventStatus.NOT_SENT ||
            event.isState() ||
            event.isRedacted()
        );
    }

    private static getSharedKeysUserId(
        props: EventTileViewModelProps,
        event: MatrixEvent,
        isEncryptionFailure: boolean,
        shieldReason: EventShieldReason | null,
    ): string | undefined {
        if (
            isLocalRoom(event.getRoomId()) ||
            isEncryptionFailure ||
            shieldReason !== EventShieldReason.AUTHENTICITY_NOT_GUARANTEED
        ) {
            return undefined;
        }

        return props.mxEvent.getKeyForwardingUser() ?? undefined;
    }

    private static getSharedKeysRoomId(
        event: MatrixEvent,
        isEncryptionFailure: boolean,
        shieldReason: EventShieldReason | null,
    ): string | undefined {
        if (
            isLocalRoom(event.getRoomId()) ||
            isEncryptionFailure ||
            shieldReason !== EventShieldReason.AUTHENTICITY_NOT_GUARANTEED
        ) {
            return undefined;
        }

        return event.getRoomId() ?? undefined;
    }
}
