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
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    type NotificationCountType,
    type Relations,
    type Room,
    RoomEvent,
    ThreadEvent,
    type Thread,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { CallErrorCode } from "matrix-js-sdk/src/webrtc/call";
import { BaseViewModel } from "@element-hq/web-shared-components";

import type LegacyCallEventGrouper from "../../components/structures/LegacyCallEventGrouper";
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
} from "../../models/rooms/EventTileModel";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { ElementCallEventType } from "../../call-types";
import { DecryptionFailureTracker } from "../../DecryptionFailureTracker";
import { isMessageEvent } from "../../events/EventTileFactory";
import { Layout } from "../../settings/enums/Layout";
import { getEventDisplayInfo } from "../../utils/EventRenderingUtils";
import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { objectHasDiff } from "../../utils/objects";
import { shouldDisplayReply } from "../../utils/Reply";
import type EditorStateTransfer from "../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import PinningUtils from "../../utils/PinningUtils";
import type { GetRelationsForEvent, ReadReceiptProps } from "../../components/views/rooms/EventTile/types";

interface EventTileInteractionSnapshot {
    actionBarFocused: boolean;
    hover: boolean;
    focusWithin: boolean;
    isContextMenuOpen: boolean;
    isQuoteExpanded?: boolean;
}

interface EventTileReceiptSnapshot {
    reactions: Relations | null;
    shouldShowSentReceipt: boolean;
    shouldShowSendingReceipt: boolean;
    showReadReceipts: boolean;
}

interface EventTileRenderingSnapshot {
    isHighlighted: boolean;
    isContinuation: boolean;
    isSending: boolean;
    isEditing: boolean;
    showReplyPreview: boolean;
    renderMode: EventTileRenderMode;
    hasRenderer: boolean;
    tileRenderType: TimelineRenderingType;
    isBubbleMessage: boolean;
    isInfoMessage: boolean;
    isLeftAlignedBubbleMessage: boolean;
    noBubbleEvent: boolean;
    isSeeingThroughMessageHiddenForModeration: boolean;
    isPinned: boolean;
    hasFooter: boolean;
}

interface EventTileTimestampSnapshot {
    showTimestamp: boolean;
    permalink: string;
    scrollToken?: string;
    timestampDisplayMode: TimestampDisplayMode;
    timestampFormatMode: TimestampFormatMode;
    timestampTs: number;
}

interface EventTileThreadSnapshot {
    thread: Thread | null;
    threadUpdateKey: string;
    threadNotification?: NotificationCountType;
    hasThread: boolean;
    isThreadRoot: boolean;
    threadPanelMode: ThreadPanelMode;
    threadInfoMode: ThreadInfoMode;
    tileClickMode: ClickMode;
    openedFromSearch: boolean;
}

interface EventTileSenderSnapshot {
    isOwnEvent: boolean;
    showSender: boolean;
    avatarSubject: AvatarSubject;
    avatarSize: AvatarSize;
    avatarMemberUserOnClick: boolean;
    avatarForceHistorical: boolean;
    senderMode: SenderMode;
}

interface EventTileEncryptionSnapshot {
    shieldColour: EventShieldColour;
    shieldReason: EventShieldReason | null;
    isEncryptionFailure: boolean;
    padlockMode: PadlockMode;
    encryptionIndicatorMode: EncryptionIndicatorMode;
    sharedKeysUserId?: string;
    sharedKeysRoomId?: string;
}

/**
 * Fully derived view state consumed by the `EventTile` rendering layer.
 */
export type EventTileViewSnapshot = EventTileInteractionSnapshot &
    EventTileReceiptSnapshot &
    EventTileRenderingSnapshot &
    EventTileTimestampSnapshot &
    EventTileThreadSnapshot &
    EventTileSenderSnapshot &
    EventTileEncryptionSnapshot;

interface EventTileCoreProps {
    cli: MatrixClient;
    mxEvent: MatrixEvent;
    eventSendStatus?: EventStatus;
    editState?: EditorStateTransfer;
    permalinkCreator?: RoomPermalinkCreator;
    callEventGrouper?: LegacyCallEventGrouper;
}

interface EventTileRenderingProps {
    forExport?: boolean;
    timelineRenderingType: TimelineRenderingType;
    layout?: Layout;
    isTwelveHour?: boolean;
    alwaysShowTimestamps?: boolean;
    isRedacted?: boolean;
    continuation?: boolean;
    last?: boolean;
    lastInSection?: boolean;
    contextual?: boolean;
    isSelectedEvent?: boolean;
    showHiddenEvents: boolean;
    isRoomEncrypted: boolean;
    hideSender?: boolean;
    hideTimestamp?: boolean;
    inhibitInteraction?: boolean;
    highlightLink?: string;
}

interface EventTileRelationProps {
    showReactions?: boolean;
    getRelationsForEvent?: GetRelationsForEvent;
    readReceipts?: ReadReceiptProps[];
    showReadReceipts?: boolean;
    lastSuccessful?: boolean;
}

/**
 * Inputs required to derive the `EventTile` view snapshot.
 */
export type EventTileViewModelProps = EventTileCoreProps & EventTileRenderingProps & EventTileRelationProps;

/**
 * Derives the render state and interaction state for a single timeline event tile.
 */
export class EventTileViewModel extends BaseViewModel<EventTileViewSnapshot, EventTileViewModelProps> {
    private isListeningForReceipts = false;
    private verifyGeneration = 0;
    private currentCli: MatrixClient | null = null;
    private currentEvent: MatrixEvent | null = null;
    private currentRoom: Room | null = null;
    private isListeningForUserTrust = false;
    private isListeningForReactions = false;

    public constructor(props: EventTileViewModelProps) {
        super(props, EventTileViewModel.deriveSnapshot(props));

        this.rebindListeners(null, props);
        this.updateReceiptListener();
        void props.cli.decryptEventIfNeeded(props.mxEvent);
        void this.verifyEvent();
    }

    public override dispose(): void {
        this.unbindAllListeners();
        super.dispose();
    }

    public setHover(hover: boolean): void {
        this.updateSnapshot({ hover });
    }

    public setFocusWithin(focusWithin: boolean): void {
        this.updateSnapshot({ focusWithin });
    }

    public setActionBarFocused(actionBarFocused: boolean): void {
        this.updateSnapshot({ actionBarFocused });
    }

    public setContextMenuOpen(isContextMenuOpen: boolean): void {
        this.updateSnapshot({
            isContextMenuOpen,
            actionBarFocused: isContextMenuOpen,
        });
    }

    public setQuoteExpanded(isQuoteExpanded: boolean): void {
        this.updateSnapshot({ isQuoteExpanded });
    }

    public updateProps(props: EventTileViewModelProps): void {
        const previousProps = this.props;
        const previousEvent = this.props.mxEvent;
        const previousEventSendStatus = this.props.eventSendStatus;
        const previousShowReactions = this.props.showReactions;

        this.props = props;
        this.rebindListeners(previousProps, props);
        this.updateSnapshot({
            reactions: EventTileViewModel.getReactions(props),
            thread: EventTileViewModel.getThread(props),
        });

        if (
            previousEvent !== props.mxEvent ||
            previousEventSendStatus !== props.eventSendStatus ||
            previousShowReactions !== props.showReactions
        ) {
            if (previousEvent !== props.mxEvent) {
                void props.cli.decryptEventIfNeeded(props.mxEvent);
            }
            void this.verifyEvent();
        }
    }

    public refreshDerivedState(): void {
        this.updateSnapshot();
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
        if (this.currentRoom !== nextRoom) {
            // Room-scoped listeners follow the room that owns the tile's event.
            this.unbindRoomListeners();
            this.bindRoomListeners(nextRoom);
        }

        if (previousProps?.cli !== nextProps.cli) {
            // Force receipt subscription to be re-evaluated against the newly bound client.
            this.isListeningForReceipts = false;
        }
    }

    private bindCliListeners(props: EventTileViewModelProps): void {
        this.currentCli = props.cli;
        if (props.forExport) return;

        // Re-verify the encryption shield when the sender's trust state changes.
        props.cli.on(CryptoEvent.UserTrustStatusChanged, this.onUserVerificationChanged);
        if (this.isListeningForReceipts) {
            // Refresh sent/sending receipt state for tiles that currently display delivery receipts.
            props.cli.on(RoomEvent.Receipt, this.onRoomReceipt);
        }
        this.isListeningForUserTrust = true;
    }

    private unbindCliListeners(): void {
        if (this.currentCli && this.isListeningForUserTrust) {
            // Drop trust updates before switching clients or exporting to avoid duplicate handlers.
            this.currentCli.off(CryptoEvent.UserTrustStatusChanged, this.onUserVerificationChanged);
        }
        if (this.currentCli && this.isListeningForReceipts) {
            // Receipt listeners are opt-in and should only stay attached while this tile needs them.
            this.currentCli.off(RoomEvent.Receipt, this.onRoomReceipt);
        }

        this.currentCli = null;
        this.isListeningForUserTrust = false;
    }

    private bindEventListeners(props: EventTileViewModelProps): void {
        this.currentEvent = props.mxEvent;
        // Keep thread summary data current as replies are added or thread metadata changes.
        props.mxEvent.on(ThreadEvent.Update, this.onThreadUpdate);

        if (props.forExport) return;

        // Recompute rendering and encryption state once an encrypted event finishes decrypting.
        props.mxEvent.on(MatrixEventEvent.Decrypted, this.onDecrypted);
        // Update the tile if this event gets edited and its replacement changes what should be rendered.
        props.mxEvent.on(MatrixEventEvent.Replaced, this.onReplaced);
        DecryptionFailureTracker.instance.addVisibleEvent(props.mxEvent);

        if (props.showReactions) {
            // Refresh the reaction summary when new reaction relations are attached to the event.
            props.mxEvent.on(MatrixEventEvent.RelationsCreated, this.onReactionsCreated);
            this.isListeningForReactions = true;
        }
    }

    private unbindEventListeners(): void {
        if (!this.currentEvent) return;

        // Remove all listeners tied to the previous event before following a new event instance.
        this.currentEvent.off(ThreadEvent.Update, this.onThreadUpdate);
        this.currentEvent.off(MatrixEventEvent.Decrypted, this.onDecrypted);
        this.currentEvent.off(MatrixEventEvent.Replaced, this.onReplaced);
        const eventId = this.currentEvent.getId();
        if (eventId) {
            DecryptionFailureTracker.instance.visibleEvents.delete(eventId);
        }
        if (this.isListeningForReactions) {
            this.currentEvent.off(MatrixEventEvent.RelationsCreated, this.onReactionsCreated);
        }

        this.currentEvent = null;
        this.isListeningForReactions = false;
    }

    private bindRoomListeners(room: Room | null): void {
        this.currentRoom = room;
        // Pick up the thread object later if this event becomes recognized as a thread root after initial render.
        room?.on(ThreadEvent.New, this.onNewThread);
    }

    private unbindRoomListeners(): void {
        // Stop watching the old room once the tile moves to a different room context.
        this.currentRoom?.off(ThreadEvent.New, this.onNewThread);
        this.currentRoom = null;
    }

    private unbindAllListeners(): void {
        this.unbindRoomListeners();
        this.unbindEventListeners();
        this.unbindCliListeners();
    }

    private updateSnapshot(partial?: Partial<EventTileViewSnapshot>): void {
        const nextSnapshot = EventTileViewModel.deriveSnapshot(this.props, this.snapshot.current, partial);

        if (objectHasDiff(this.snapshot.current, nextSnapshot)) {
            this.snapshot.set(nextSnapshot);
        }

        this.updateReceiptListener(nextSnapshot);
    }

    private updateReceiptListener(snapshot: EventTileViewSnapshot = this.snapshot.current): void {
        const shouldListen = snapshot.shouldShowSentReceipt || snapshot.shouldShowSendingReceipt;
        if (shouldListen && !this.isListeningForReceipts) {
            // Only subscribe to room receipts while this tile renders sent/sending receipt affordances.
            this.currentCli?.on(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = true;
        } else if (!shouldListen && this.isListeningForReceipts) {
            // Drop the receipt listener once receipt state is no longer visible for this tile.
            this.currentCli?.off(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = false;
        }
    }

    private getReactions(): Relations | null {
        return EventTileViewModel.getReactions(this.props);
    }

    private readonly onRoomReceipt = (_event: MatrixEvent, room: Room): void => {
        const roomId = this.props.mxEvent.getRoomId();
        const tileRoom = roomId ? this.props.cli.getRoom(roomId) : null;
        if (room !== tileRoom) return;

        this.updateSnapshot();
    };

    private onDecrypted = (): void => {
        void this.verifyEvent();
        this.updateSnapshot();
    };

    private onUserVerificationChanged = (userId: string, _trustStatus: UserVerificationStatus): void => {
        if (userId === this.props.mxEvent.getSender()) {
            void this.verifyEvent();
        }
    };

    private onReplaced = (): void => {
        void this.verifyEvent();
        this.updateSnapshot();
    };

    private onReactionsCreated = (relationType: string, eventType: string): void => {
        if (relationType !== "m.annotation" || eventType !== "m.reaction") {
            return;
        }

        this.updateSnapshot({
            reactions: this.getReactions(),
        });
    };

    private updateThread = (thread: Thread): void => {
        this.updateSnapshot({ thread });
    };

    private onThreadUpdate = (thread: Thread): void => {
        this.updateThread(thread);
    };

    private onNewThread = (thread: Thread): void => {
        if (thread.id === this.props.mxEvent.getId()) {
            this.updateThread(thread);
            this.currentRoom?.off(ThreadEvent.New, this.onNewThread);
        }
    };

    private async verifyEvent(): Promise<void> {
        try {
            const verifyGeneration = ++this.verifyGeneration;
            const event = this.props.mxEvent.replacingEvent() ?? this.props.mxEvent;

            if (!event.isEncrypted() || event.isRedacted()) {
                this.updateSnapshot({
                    shieldColour: EventShieldColour.NONE,
                    shieldReason: null,
                });
                return;
            }

            const encryptionInfo = (await this.props.cli.getCrypto()?.getEncryptionInfoForEvent(event)) ?? null;
            if (this.isDisposed || verifyGeneration !== this.verifyGeneration) {
                return;
            }
            if (encryptionInfo === null) {
                this.updateSnapshot({
                    shieldColour: EventShieldColour.NONE,
                    shieldReason: null,
                });
                return;
            }

            this.updateSnapshot({
                shieldColour: encryptionInfo.shieldColour,
                shieldReason: encryptionInfo.shieldReason,
            });
        } catch (error) {
            logger.error(
                `Error getting encryption info on event ${this.props.mxEvent.getId()} in room ${this.props.mxEvent.getRoomId()}`,
                error,
            );
        }
    }

    /**
     * Builds the full tile view state from current props plus any listener-driven partial updates.
     * Merge order matters here: defaults are seeded first, then previous/partial state is preserved,
     * and finally the derived fields are recomputed from the latest props.
     */
    private static deriveSnapshot(
        props: EventTileViewModelProps,
        previousSnapshot?: EventTileViewSnapshot,
        partial: Partial<EventTileViewSnapshot> = {},
    ): EventTileViewSnapshot {
        const snapshot: EventTileViewSnapshot = {
            actionBarFocused: false,
            shieldColour: EventShieldColour.NONE,
            shieldReason: null,
            reactions: null,
            hover: false,
            focusWithin: false,
            isContextMenuOpen: false,
            isQuoteExpanded: undefined,
            thread: null,
            threadUpdateKey: "",
            threadNotification: undefined,
            shouldShowSentReceipt: false,
            shouldShowSendingReceipt: false,
            isHighlighted: false,
            showTimestamp: false,
            isContinuation: false,
            isSending: false,
            isEditing: false,
            showReplyPreview: false,
            renderMode: EventTileRenderMode.Rendered,
            isEncryptionFailure: false,
            isOwnEvent: false,
            permalink: "#",
            scrollToken: undefined,
            hasThread: false,
            isThreadRoot: false,
            hasRenderer: false,
            isBubbleMessage: false,
            isInfoMessage: false,
            isLeftAlignedBubbleMessage: false,
            noBubbleEvent: false,
            isSeeingThroughMessageHiddenForModeration: false,
            showSender: false,
            avatarSubject: AvatarSubject.None,
            threadPanelMode: ThreadPanelMode.None,
            showReadReceipts: false,
            padlockMode: PadlockMode.None,
            timestampDisplayMode: TimestampDisplayMode.Hidden,
            timestampFormatMode: TimestampFormatMode.Absolute,
            timestampTs: props.mxEvent.getTs(),
            tileRenderType: props.timelineRenderingType,
            avatarSize: AvatarSize.None,
            avatarMemberUserOnClick: false,
            avatarForceHistorical: false,
            senderMode: SenderMode.Hidden,
            isPinned: false,
            hasFooter: false,
            encryptionIndicatorMode: EncryptionIndicatorMode.None,
            sharedKeysUserId: undefined,
            sharedKeysRoomId: undefined,
            threadInfoMode: ThreadInfoMode.None,
            tileClickMode: ClickMode.None,
            openedFromSearch: false,
            ...previousSnapshot,
            ...partial,
        };

        const displayInfo = EventTileViewModel.getDisplayInfo(props);
        snapshot.reactions = partial.reactions ?? previousSnapshot?.reactions ?? EventTileViewModel.getReactions(props);
        snapshot.thread = partial.thread ?? previousSnapshot?.thread ?? EventTileViewModel.getThread(props);
        snapshot.shouldShowSentReceipt = EventTileViewModel.getShouldShowSentReceipt(props);
        snapshot.shouldShowSendingReceipt = EventTileViewModel.getShouldShowSendingReceipt(props);
        snapshot.isHighlighted = EventTileViewModel.getShouldHighlight(props);
        snapshot.isSending = EventTileViewModel.getIsSending(props);
        snapshot.isEditing = EventTileViewModel.getIsEditing(props);
        snapshot.showReplyPreview = EventTileViewModel.getShowReplyPreview(props);
        snapshot.isEncryptionFailure = EventTileViewModel.getIsEncryptionFailure(props);
        snapshot.isOwnEvent = EventTileViewModel.getIsOwnEvent(props);
        snapshot.permalink = EventTileViewModel.getPermalink(props);
        snapshot.scrollToken = EventTileViewModel.getScrollToken(props);
        snapshot.isContinuation = EventTileViewModel.getIsContinuation(props);
        snapshot.showTimestamp = EventTileViewModel.getShowTimestamp(props, snapshot);
        snapshot.hasThread = Boolean(snapshot.thread);
        snapshot.isThreadRoot = snapshot.thread?.id === props.mxEvent.getId();
        snapshot.threadUpdateKey = EventTileViewModel.getThreadUpdateKey(snapshot.thread);
        snapshot.hasRenderer = displayInfo.hasRenderer;
        snapshot.renderMode = EventTileViewModel.getRenderMode(props, displayInfo.hasRenderer);
        snapshot.isBubbleMessage = displayInfo.isBubbleMessage;
        snapshot.isInfoMessage = displayInfo.isInfoMessage;
        snapshot.isLeftAlignedBubbleMessage = displayInfo.isLeftAlignedBubbleMessage;
        snapshot.noBubbleEvent = displayInfo.noBubbleEvent;
        snapshot.isSeeingThroughMessageHiddenForModeration = displayInfo.isSeeingThroughMessageHiddenForModeration;
        snapshot.showSender = EventTileViewModel.getShowSender(props);
        snapshot.threadPanelMode = EventTileViewModel.getThreadPanelMode(props, snapshot);
        snapshot.showReadReceipts = EventTileViewModel.getShowReadReceipts(props, snapshot);
        snapshot.padlockMode = EventTileViewModel.getPadlockMode(props, snapshot);
        snapshot.timestampDisplayMode = EventTileViewModel.getTimestampDisplayMode(props, snapshot);
        snapshot.timestampFormatMode = EventTileViewModel.getTimestampFormatMode(props);
        snapshot.timestampTs = EventTileViewModel.getTimestampTs(props, snapshot);
        snapshot.tileRenderType = EventTileViewModel.getTileRenderType(props);
        snapshot.avatarSize = EventTileViewModel.getAvatarSize(props, snapshot);
        snapshot.avatarSubject = EventTileViewModel.getAvatarSubject(props, snapshot);
        snapshot.avatarMemberUserOnClick = EventTileViewModel.getAvatarMemberUserOnClick(props, snapshot);
        snapshot.avatarForceHistorical = EventTileViewModel.getAvatarForceHistorical(props);
        snapshot.senderMode = EventTileViewModel.getSenderMode(props, snapshot);
        snapshot.isPinned = EventTileViewModel.getIsPinned(props);
        snapshot.hasFooter = EventTileViewModel.getHasFooter(snapshot);
        snapshot.encryptionIndicatorMode = EventTileViewModel.getEncryptionIndicatorMode(props, snapshot);
        snapshot.sharedKeysUserId = EventTileViewModel.getSharedKeysUserId(props, snapshot);
        snapshot.sharedKeysRoomId = EventTileViewModel.getSharedKeysRoomId(props);
        snapshot.threadInfoMode = EventTileViewModel.getThreadInfoMode(props, snapshot);
        snapshot.tileClickMode = EventTileViewModel.getTileClickMode(props);
        snapshot.openedFromSearch = EventTileViewModel.getOpenedFromSearch(props);
        return snapshot;
    }

    private static getDisplayInfo(props: EventTileViewModelProps): ReturnType<typeof getEventDisplayInfo> {
        return getEventDisplayInfo(props.cli, props.mxEvent, props.showHiddenEvents, this.shouldHideEvent(props));
    }

    private static getRoom(props: EventTileViewModelProps): Room | null {
        const roomId = props.mxEvent.getRoomId();
        return roomId ? props.cli.getRoom(roomId) : null;
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

    private static shouldHideEvent(props: EventTileViewModelProps): boolean {
        return props.callEventGrouper?.hangupReason === CallErrorCode.Replaced;
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

    private static getIsEncryptionFailure(props: EventTileViewModelProps): boolean {
        return props.mxEvent.isDecryptionFailure();
    }

    private static getIsOwnEvent(props: EventTileViewModelProps): boolean {
        return props.mxEvent.getSender() === props.cli.getUserId();
    }

    private static getPermalink(props: EventTileViewModelProps): string {
        const eventId = props.mxEvent.getId();
        if (!props.permalinkCreator || !eventId) return "#";
        return props.permalinkCreator.forEvent(eventId);
    }

    private static getScrollToken(props: EventTileViewModelProps): string | undefined {
        return props.mxEvent.status ? undefined : (props.mxEvent.getId() ?? undefined);
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

    private static getShowTimestamp(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return Boolean(
            props.mxEvent.getTs() &&
            !props.hideTimestamp &&
            (props.alwaysShowTimestamps ||
                props.last ||
                snapshot.hover ||
                snapshot.focusWithin ||
                snapshot.actionBarFocused ||
                snapshot.isContextMenuOpen),
        );
    }

    private static getShowSender(props: EventTileViewModelProps): boolean {
        return !props.hideSender;
    }

    private static getShowReplyPreview(props: EventTileViewModelProps): boolean {
        return !this.shouldHideEvent(props) && shouldDisplayReply(props.mxEvent);
    }

    private static getAvatarSubject(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): AvatarSubject {
        if (snapshot.avatarSize === AvatarSize.None) {
            return AvatarSubject.None;
        }

        return props.mxEvent.getContent().third_party_invite ? AvatarSubject.Target : AvatarSubject.Sender;
    }

    private static getRenderMode(props: EventTileViewModelProps, hasRenderer: boolean): EventTileRenderMode {
        if (!hasRenderer && props.timelineRenderingType !== TimelineRenderingType.Notification) {
            return EventTileRenderMode.MissingRendererFallback;
        }

        return EventTileRenderMode.Rendered;
    }

    private static getThreadPanelMode(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): ThreadPanelMode {
        const showsToolbar = props.timelineRenderingType === TimelineRenderingType.ThreadsList;
        const showsSummary =
            (props.timelineRenderingType === TimelineRenderingType.Notification ||
                props.timelineRenderingType === TimelineRenderingType.ThreadsList) &&
            Boolean(snapshot.thread);

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

    private static getShowReadReceipts(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return !snapshot.shouldShowSentReceipt && !snapshot.shouldShowSendingReceipt && Boolean(props.showReadReceipts);
    }

    private static getPadlockMode(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): PadlockMode {
        if (snapshot.isBubbleMessage) return PadlockMode.None;
        return props.layout === Layout.IRC ? PadlockMode.Irc : PadlockMode.Group;
    }

    private static getTimestampDisplayMode(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): TimestampDisplayMode {
        if (!snapshot.showTimestamp) {
            return props.layout === Layout.IRC ? TimestampDisplayMode.Placeholder : TimestampDisplayMode.Hidden;
        }

        return props.timelineRenderingType !== TimelineRenderingType.Notification
            ? TimestampDisplayMode.Linked
            : TimestampDisplayMode.Plain;
    }

    private static getTimestampFormatMode(props: EventTileViewModelProps): TimestampFormatMode {
        return props.timelineRenderingType === TimelineRenderingType.ThreadsList
            ? TimestampFormatMode.Relative
            : TimestampFormatMode.Absolute;
    }

    private static getTimestampTs(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): number {
        if (props.timelineRenderingType !== TimelineRenderingType.ThreadsList) {
            return props.mxEvent.getTs();
        }

        return snapshot.thread?.replyToEvent?.getTs() ?? props.mxEvent.getTs();
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

    private static getAvatarSize(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): AvatarSize {
        // Avatar visibility is driven by timeline context and event type, and stays aligned with
        // the sender-profile rules used by getNeedsSenderProfile/getSenderMode below.
        const eventType = props.mxEvent.getType();

        if (props.timelineRenderingType === TimelineRenderingType.Notification) {
            return AvatarSize.Medium;
        }

        if (snapshot.isInfoMessage) {
            return AvatarSize.XSmall;
        }

        if (
            props.timelineRenderingType === TimelineRenderingType.ThreadsList ||
            (props.timelineRenderingType === TimelineRenderingType.Thread && !props.continuation)
        ) {
            return AvatarSize.XLarge;
        }

        if (eventType === EventType.RoomCreate || snapshot.isBubbleMessage) {
            return AvatarSize.None;
        }

        if (props.layout === Layout.IRC) {
            return AvatarSize.XSmall;
        }

        if (
            (props.continuation && props.timelineRenderingType !== TimelineRenderingType.File) ||
            eventType === EventType.CallInvite ||
            ElementCallEventType.matches(eventType)
        ) {
            return AvatarSize.None;
        }

        if (props.timelineRenderingType === TimelineRenderingType.File) {
            return AvatarSize.Small;
        }

        return AvatarSize.Large;
    }

    private static getAvatarMemberUserOnClick(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): boolean {
        if (snapshot.avatarSize === AvatarSize.None) return false;
        if (!EventTileViewModel.getNeedsSenderProfile(props, snapshot)) return false;
        if (props.inhibitInteraction) return false;

        return ![TimelineRenderingType.ThreadsList, TimelineRenderingType.Notification].includes(
            props.timelineRenderingType,
        );
    }

    private static getAvatarForceHistorical(props: EventTileViewModelProps): boolean {
        return props.mxEvent.getType() === EventType.RoomMember;
    }

    private static getSenderMode(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): SenderMode {
        if (!snapshot.showSender || !EventTileViewModel.getNeedsSenderProfile(props, snapshot)) {
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

    private static getNeedsSenderProfile(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        // This gates whether the sender is shown as an interactive profile-bearing identity at all.
        const eventType = props.mxEvent.getType();

        if (props.timelineRenderingType === TimelineRenderingType.Notification) {
            return true;
        }

        if (snapshot.isInfoMessage) {
            return false;
        }

        if (
            props.timelineRenderingType === TimelineRenderingType.ThreadsList ||
            (props.timelineRenderingType === TimelineRenderingType.Thread && !props.continuation)
        ) {
            return true;
        }

        if (eventType === EventType.RoomCreate || snapshot.isBubbleMessage) {
            return false;
        }

        if (props.layout === Layout.IRC) {
            return true;
        }

        if (
            (props.continuation && props.timelineRenderingType !== TimelineRenderingType.File) ||
            eventType === EventType.CallInvite ||
            ElementCallEventType.matches(eventType)
        ) {
            return false;
        }

        if (props.timelineRenderingType === TimelineRenderingType.File) {
            return true;
        }

        return true;
    }

    private static getIsPinned(props: EventTileViewModelProps): boolean {
        return PinningUtils.isPinned(props.cli, props.mxEvent);
    }

    private static getHasFooter(snapshot: EventTileViewSnapshot): boolean {
        return snapshot.isPinned || !!snapshot.reactions;
    }

    private static getEncryptionIndicatorMode(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): EncryptionIndicatorMode {
        // Collapse crypto and shield state into the UI-level indicator the tile should render.
        const event = props.mxEvent.replacingEvent() ?? props.mxEvent;

        if (isLocalRoom(event.getRoomId()!)) return EncryptionIndicatorMode.None;

        if (event.isDecryptionFailure()) {
            switch (event.decryptionFailureReason) {
                case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
                case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                    return EncryptionIndicatorMode.None;
                default:
                    return EncryptionIndicatorMode.DecryptionFailure;
            }
        }

        if (
            snapshot.shieldReason === EventShieldReason.AUTHENTICITY_NOT_GUARANTEED &&
            props.mxEvent.getKeyForwardingUser()
        ) {
            return EncryptionIndicatorMode.None;
        }

        if (snapshot.shieldColour !== EventShieldColour.NONE) {
            return snapshot.shieldColour === EventShieldColour.GREY
                ? EncryptionIndicatorMode.Normal
                : EncryptionIndicatorMode.Warning;
        }

        if (props.isRoomEncrypted) {
            if (event.status === EventStatus.ENCRYPTING) return EncryptionIndicatorMode.None;
            if (event.status === EventStatus.NOT_SENT) return EncryptionIndicatorMode.None;
            if (event.isState()) return EncryptionIndicatorMode.None;
            if (event.isRedacted()) return EncryptionIndicatorMode.None;
            if (!event.isEncrypted()) return EncryptionIndicatorMode.Warning;
        }

        return EncryptionIndicatorMode.None;
    }

    private static getSharedKeysUserId(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): string | undefined {
        if (snapshot.shieldReason !== EventShieldReason.AUTHENTICITY_NOT_GUARANTEED) {
            return undefined;
        }

        return props.mxEvent.getKeyForwardingUser() ?? undefined;
    }

    private static getSharedKeysRoomId(props: EventTileViewModelProps): string | undefined {
        const event = props.mxEvent.replacingEvent() ?? props.mxEvent;
        return event.getRoomId() ?? undefined;
    }

    private static getThreadInfoMode(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): ThreadInfoMode {
        if (snapshot.isThreadRoot && snapshot.thread) {
            return ThreadInfoMode.Summary;
        }

        if (props.timelineRenderingType === TimelineRenderingType.Search && props.mxEvent.threadRootId) {
            return props.highlightLink ? ThreadInfoMode.SearchLink : ThreadInfoMode.SearchText;
        }

        return ThreadInfoMode.None;
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

    private static getThreadUpdateKey(thread: Thread | null): string {
        if (!thread) return "";

        return `${thread.id}:${thread.length}:${thread.replyToEvent?.getId() ?? ""}`;
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
}
