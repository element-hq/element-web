/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
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
    MsgType,
    type NotificationCountType,
    type Relations,
    type RelationType,
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
    ClickMode,
    EncryptionIndicatorMode,
    SenderMode,
    ThreadInfoMode,
} from "../../components/views/rooms/EventTile/EventTileModes";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { _t } from "../../languageHandler";
import { ElementCallEventType } from "../../call-types";
import { DecryptionFailureTracker } from "../../DecryptionFailureTracker";
import { isMessageEvent } from "../../events/EventTileFactory";
import { Layout } from "../../settings/enums/Layout";
import { getEventDisplayInfo } from "../../utils/EventRenderingUtils";
import { MediaEventHelper } from "../../utils/MediaEventHelper";
import { isLocalRoom } from "../../utils/localRoom/isLocalRoom";
import { objectHasDiff } from "../../utils/objects";
import type EditorStateTransfer from "../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../utils/permalinks/Permalinks";
import PinningUtils from "../../utils/PinningUtils";

export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

export interface IReadReceiptProps {
    userId: string;
    ts: number;
}

export interface EventTileContextMenuState {
    position: Pick<DOMRect, "top" | "left" | "bottom">;
    link?: string;
}

export interface EventTileViewSnapshot {
    actionBarFocused: boolean;
    shieldColour: EventShieldColour;
    shieldReason: EventShieldReason | null;
    reactions: Relations | null;
    hover: boolean;
    focusWithin: boolean;
    contextMenu?: EventTileContextMenuState;
    isQuoteExpanded: boolean;
    thread: Thread | null;
    threadUpdateKey: string;
    threadNotification?: NotificationCountType;
    shouldShowSentReceipt: boolean;
    shouldShowSendingReceipt: boolean;
    isHighlighted: boolean;
    showTimestamp: boolean;
    isContinuation: boolean;
    classes: string;
    lineClasses: string;
    isSending: boolean;
    isEditing: boolean;
    isEncryptionFailure: boolean;
    isOwnEvent: boolean;
    permalink: string;
    scrollToken?: string;
    hasThread: boolean;
    isThreadRoot: boolean;
    hasRenderer: boolean;
    isBubbleMessage: boolean;
    isInfoMessage: boolean;
    isLeftAlignedBubbleMessage: boolean;
    noBubbleEvent: boolean;
    isSeeingThroughMessageHiddenForModeration: boolean;
    showSender: boolean;
    showThreadToolbar: boolean;
    showThreadPanelSummary: boolean;
    showReadReceipts: boolean;
    showGroupPadlock: boolean;
    showIrcPadlock: boolean;
    showLinkedTimestamp: boolean;
    showDummyTimestamp: boolean;
    showRelativeTimestamp: boolean;
    timestampTs: number;
    tileRenderType: TimelineRenderingType;
    avatarSize: string | null;
    avatarMemberUserOnClick: boolean;
    avatarForceHistorical: boolean;
    senderMode: SenderMode;
    isPinned: boolean;
    hasFooter: boolean;
    encryptionIndicatorMode: EncryptionIndicatorMode;
    encryptionIndicatorTitle?: string;
    sharedKeysUserId?: string;
    sharedKeysRoomId?: string;
    threadInfoMode: ThreadInfoMode;
    tileClickMode: ClickMode;
    viewRoomMetricsTrigger?: "MessageSearch";
}

export interface EventTileViewModelProps {
    cli: MatrixClient;
    mxEvent: MatrixEvent;
    forExport?: boolean;
    showReactions?: boolean;
    getRelationsForEvent?: GetRelationsForEvent;
    readReceipts?: IReadReceiptProps[];
    lastSuccessful?: boolean;
    eventSendStatus?: EventStatus;
    timelineRenderingType: TimelineRenderingType;
    isRedacted?: boolean;
    continuation?: boolean;
    last?: boolean;
    lastInSection?: boolean;
    contextual?: boolean;
    isSelectedEvent?: boolean;
    isTwelveHour?: boolean;
    layout?: Layout;
    editState?: EditorStateTransfer;
    permalinkCreator?: RoomPermalinkCreator;
    alwaysShowTimestamps?: boolean;
    hideSender?: boolean;
    hideTimestamp?: boolean;
    inhibitInteraction?: boolean;
    showReadReceipts?: boolean;
    highlightLink?: string;
    isRoomEncrypted: boolean;
    callEventGrouper?: LegacyCallEventGrouper;
    showHiddenEvents: boolean;
}

export class EventTileViewModel extends BaseViewModel<EventTileViewSnapshot, EventTileViewModelProps> {
    private isListeningForReceipts = false;
    private verifyGeneration = 0;

    public constructor(props: EventTileViewModelProps) {
        super(props, EventTileViewModel.computeSnapshot(props));

        if (!props.forExport) {
            this.disposables.trackListener(props.cli, CryptoEvent.UserTrustStatusChanged, (...args: unknown[]) =>
                this.onUserVerificationChanged(args[0] as string, args[1] as UserVerificationStatus),
            );
            this.disposables.trackListener(props.mxEvent, MatrixEventEvent.Decrypted, this.onDecrypted);
            this.disposables.trackListener(props.mxEvent, MatrixEventEvent.Replaced, this.onReplaced);
            DecryptionFailureTracker.instance.addVisibleEvent(props.mxEvent);

            if (props.showReactions) {
                this.disposables.trackListener(props.mxEvent, MatrixEventEvent.RelationsCreated, (...args: unknown[]) =>
                    this.onReactionsCreated(args[0] as string, args[1] as string),
                );
            }
        }

        this.disposables.trackListener(props.mxEvent, ThreadEvent.Update, (...args: unknown[]) =>
            this.updateThread(args[0] as Thread),
        );

        const roomId = props.mxEvent.getRoomId();
        const room = roomId ? props.cli.getRoom(roomId) : null;
        if (room) {
            this.disposables.trackListener(room, ThreadEvent.New, (...args: unknown[]) =>
                this.onNewThread(args[0] as Thread),
            );
        }

        this.updateReceiptListener();
        void props.cli.decryptEventIfNeeded(props.mxEvent);
        void this.verifyEvent();
    }

    public override dispose(): void {
        if (this.isListeningForReceipts) {
            this.props.cli.off(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = false;
        }
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

    public setContextMenu(contextMenu?: EventTileContextMenuState): void {
        this.updateSnapshot({
            contextMenu,
            actionBarFocused: Boolean(contextMenu),
        });
    }

    public setQuoteExpanded(isQuoteExpanded: boolean): void {
        this.updateSnapshot({ isQuoteExpanded });
    }

    public updateProps(props: EventTileViewModelProps): void {
        const previousEvent = this.props.mxEvent;
        const previousEventSendStatus = this.props.eventSendStatus;
        const previousShowReactions = this.props.showReactions;

        this.props = props;
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
                if (!props.forExport) {
                    DecryptionFailureTracker.instance.addVisibleEvent(props.mxEvent);
                }
                void props.cli.decryptEventIfNeeded(props.mxEvent);
            }
            void this.verifyEvent();
        }
    }

    public refreshDerivedState(): void {
        this.updateSnapshot();
    }

    private updateSnapshot(partial?: Partial<EventTileViewSnapshot>): void {
        const nextSnapshot = {
            ...this.snapshot.current,
            ...partial,
        };

        nextSnapshot.shouldShowSentReceipt = this.getShouldShowSentReceipt();
        nextSnapshot.shouldShowSendingReceipt = this.getShouldShowSendingReceipt();
        nextSnapshot.isHighlighted = this.getShouldHighlight();
        nextSnapshot.isSending = EventTileViewModel.getIsSending(this.props);
        nextSnapshot.isEditing = EventTileViewModel.getIsEditing(this.props);
        nextSnapshot.isEncryptionFailure = EventTileViewModel.getIsEncryptionFailure(this.props);
        nextSnapshot.isOwnEvent = EventTileViewModel.getIsOwnEvent(this.props);
        nextSnapshot.permalink = EventTileViewModel.getPermalink(this.props);
        nextSnapshot.scrollToken = EventTileViewModel.getScrollToken(this.props);
        nextSnapshot.isContinuation = EventTileViewModel.getIsContinuation(this.props);
        nextSnapshot.lineClasses = EventTileViewModel.getLineClasses(this.props);
        nextSnapshot.showTimestamp = EventTileViewModel.getShowTimestamp(this.props, nextSnapshot);
        nextSnapshot.hasThread = Boolean(nextSnapshot.thread);
        nextSnapshot.isThreadRoot = nextSnapshot.thread?.id === this.props.mxEvent.getId();
        nextSnapshot.threadUpdateKey = EventTileViewModel.getThreadUpdateKey(nextSnapshot.thread);
        nextSnapshot.hasRenderer = EventTileViewModel.getDisplayInfo(this.props).hasRenderer;
        nextSnapshot.isBubbleMessage = EventTileViewModel.getDisplayInfo(this.props).isBubbleMessage;
        nextSnapshot.isInfoMessage = EventTileViewModel.getDisplayInfo(this.props).isInfoMessage;
        nextSnapshot.isLeftAlignedBubbleMessage = EventTileViewModel.getDisplayInfo(
            this.props,
        ).isLeftAlignedBubbleMessage;
        nextSnapshot.noBubbleEvent = EventTileViewModel.getDisplayInfo(this.props).noBubbleEvent;
        nextSnapshot.isSeeingThroughMessageHiddenForModeration = EventTileViewModel.getDisplayInfo(
            this.props,
        ).isSeeingThroughMessageHiddenForModeration;
        nextSnapshot.showSender = EventTileViewModel.getShowSender(this.props);
        nextSnapshot.showThreadToolbar = EventTileViewModel.getShowThreadToolbar(this.props);
        nextSnapshot.showThreadPanelSummary = EventTileViewModel.getShowThreadPanelSummary(this.props, nextSnapshot);
        nextSnapshot.showReadReceipts = EventTileViewModel.getShowReadReceipts(this.props, nextSnapshot);
        nextSnapshot.showGroupPadlock = EventTileViewModel.getShowGroupPadlock(this.props, nextSnapshot);
        nextSnapshot.showIrcPadlock = EventTileViewModel.getShowIrcPadlock(this.props, nextSnapshot);
        nextSnapshot.showLinkedTimestamp = EventTileViewModel.getShowLinkedTimestamp(this.props);
        nextSnapshot.showDummyTimestamp = EventTileViewModel.getShowDummyTimestamp(this.props, nextSnapshot);
        nextSnapshot.showRelativeTimestamp = EventTileViewModel.getShowRelativeTimestamp(this.props);
        nextSnapshot.timestampTs = EventTileViewModel.getTimestampTs(this.props, nextSnapshot);
        nextSnapshot.tileRenderType = EventTileViewModel.getTileRenderType(this.props);
        nextSnapshot.avatarSize = EventTileViewModel.getAvatarSize(this.props, nextSnapshot);
        nextSnapshot.avatarMemberUserOnClick = EventTileViewModel.getAvatarMemberUserOnClick(this.props, nextSnapshot);
        nextSnapshot.avatarForceHistorical = EventTileViewModel.getAvatarForceHistorical(this.props);
        nextSnapshot.senderMode = EventTileViewModel.getSenderMode(this.props, nextSnapshot);
        nextSnapshot.isPinned = EventTileViewModel.getIsPinned(this.props);
        nextSnapshot.hasFooter = EventTileViewModel.getHasFooter(nextSnapshot);
        nextSnapshot.encryptionIndicatorMode = EventTileViewModel.getEncryptionIndicatorMode(this.props, nextSnapshot);
        nextSnapshot.encryptionIndicatorTitle = EventTileViewModel.getEncryptionIndicatorTitle(this.props, nextSnapshot);
        nextSnapshot.sharedKeysUserId = EventTileViewModel.getSharedKeysUserId(this.props, nextSnapshot);
        nextSnapshot.sharedKeysRoomId = EventTileViewModel.getSharedKeysRoomId(this.props);
        nextSnapshot.threadInfoMode = EventTileViewModel.getThreadInfoMode(this.props, nextSnapshot);
        nextSnapshot.tileClickMode = EventTileViewModel.getTileClickMode(this.props);
        nextSnapshot.viewRoomMetricsTrigger = EventTileViewModel.getViewRoomMetricsTrigger(this.props);
        nextSnapshot.classes = EventTileViewModel.getClasses(this.props, nextSnapshot);

        if (objectHasDiff(this.snapshot.current, nextSnapshot)) {
            this.snapshot.set(nextSnapshot);
        }

        this.updateReceiptListener();
    }

    private updateReceiptListener(): void {
        const shouldListen = this.getShouldShowSentReceipt() || this.getShouldShowSendingReceipt();
        if (shouldListen && !this.isListeningForReceipts) {
            this.props.cli.on(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = true;
        } else if (!shouldListen && this.isListeningForReceipts) {
            this.props.cli.off(RoomEvent.Receipt, this.onRoomReceipt);
            this.isListeningForReceipts = false;
        }
    }

    private static computeSnapshot(props: EventTileViewModelProps): EventTileViewSnapshot {
        const snapshot: EventTileViewSnapshot = {
            actionBarFocused: false,
            shieldColour: EventShieldColour.NONE,
            shieldReason: null,
            reactions: EventTileViewModel.getReactions(props),
            hover: false,
            focusWithin: false,
            contextMenu: undefined,
            isQuoteExpanded: false,
            thread: EventTileViewModel.getThread(props),
            threadUpdateKey: "",
            threadNotification: undefined,
            shouldShowSentReceipt: EventTileViewModel.getShouldShowSentReceipt(props),
            shouldShowSendingReceipt: EventTileViewModel.getShouldShowSendingReceipt(props),
            isHighlighted: EventTileViewModel.getShouldHighlight(props),
            showTimestamp: false,
            isContinuation: false,
            classes: "",
            lineClasses: "",
            isSending: false,
            isEditing: false,
            isEncryptionFailure: false,
            isOwnEvent: false,
            permalink: EventTileViewModel.getPermalink(props),
            scrollToken: EventTileViewModel.getScrollToken(props),
            hasThread: false,
            isThreadRoot: false,
            hasRenderer: false,
            isBubbleMessage: false,
            isInfoMessage: false,
            isLeftAlignedBubbleMessage: false,
            noBubbleEvent: false,
            isSeeingThroughMessageHiddenForModeration: false,
            showSender: false,
            showThreadToolbar: false,
            showThreadPanelSummary: false,
            showReadReceipts: false,
            showGroupPadlock: false,
            showIrcPadlock: false,
            showLinkedTimestamp: false,
            showDummyTimestamp: false,
            showRelativeTimestamp: false,
            timestampTs: props.mxEvent.getTs(),
            tileRenderType: props.timelineRenderingType,
            avatarSize: null,
            avatarMemberUserOnClick: false,
            avatarForceHistorical: false,
            senderMode: SenderMode.Hidden,
            isPinned: false,
            hasFooter: false,
            encryptionIndicatorMode: EncryptionIndicatorMode.None,
            encryptionIndicatorTitle: undefined,
            sharedKeysUserId: undefined,
            sharedKeysRoomId: undefined,
            threadInfoMode: ThreadInfoMode.None,
            tileClickMode: ClickMode.None,
            viewRoomMetricsTrigger: undefined,
        };
        const displayInfo = EventTileViewModel.getDisplayInfo(props);
        snapshot.isSending = EventTileViewModel.getIsSending(props);
        snapshot.isEditing = EventTileViewModel.getIsEditing(props);
        snapshot.isEncryptionFailure = EventTileViewModel.getIsEncryptionFailure(props);
        snapshot.isOwnEvent = EventTileViewModel.getIsOwnEvent(props);
        snapshot.isContinuation = EventTileViewModel.getIsContinuation(props);
        snapshot.lineClasses = EventTileViewModel.getLineClasses(props);
        snapshot.showTimestamp = EventTileViewModel.getShowTimestamp(props, snapshot);
        snapshot.hasThread = Boolean(snapshot.thread);
        snapshot.isThreadRoot = snapshot.thread?.id === props.mxEvent.getId();
        snapshot.threadUpdateKey = EventTileViewModel.getThreadUpdateKey(snapshot.thread);
        snapshot.hasRenderer = displayInfo.hasRenderer;
        snapshot.isBubbleMessage = displayInfo.isBubbleMessage;
        snapshot.isInfoMessage = displayInfo.isInfoMessage;
        snapshot.isLeftAlignedBubbleMessage = displayInfo.isLeftAlignedBubbleMessage;
        snapshot.noBubbleEvent = displayInfo.noBubbleEvent;
        snapshot.isSeeingThroughMessageHiddenForModeration = displayInfo.isSeeingThroughMessageHiddenForModeration;
        snapshot.showSender = EventTileViewModel.getShowSender(props);
        snapshot.showThreadToolbar = EventTileViewModel.getShowThreadToolbar(props);
        snapshot.showThreadPanelSummary = EventTileViewModel.getShowThreadPanelSummary(props, snapshot);
        snapshot.showReadReceipts = EventTileViewModel.getShowReadReceipts(props, snapshot);
        snapshot.showGroupPadlock = EventTileViewModel.getShowGroupPadlock(props, snapshot);
        snapshot.showIrcPadlock = EventTileViewModel.getShowIrcPadlock(props, snapshot);
        snapshot.showLinkedTimestamp = EventTileViewModel.getShowLinkedTimestamp(props);
        snapshot.showDummyTimestamp = EventTileViewModel.getShowDummyTimestamp(props, snapshot);
        snapshot.showRelativeTimestamp = EventTileViewModel.getShowRelativeTimestamp(props);
        snapshot.timestampTs = EventTileViewModel.getTimestampTs(props, snapshot);
        snapshot.tileRenderType = EventTileViewModel.getTileRenderType(props);
        snapshot.avatarSize = EventTileViewModel.getAvatarSize(props, snapshot);
        snapshot.avatarMemberUserOnClick = EventTileViewModel.getAvatarMemberUserOnClick(props, snapshot);
        snapshot.avatarForceHistorical = EventTileViewModel.getAvatarForceHistorical(props);
        snapshot.senderMode = EventTileViewModel.getSenderMode(props, snapshot);
        snapshot.isPinned = EventTileViewModel.getIsPinned(props);
        snapshot.hasFooter = EventTileViewModel.getHasFooter(snapshot);
        snapshot.encryptionIndicatorMode = EventTileViewModel.getEncryptionIndicatorMode(props, snapshot);
        snapshot.encryptionIndicatorTitle = EventTileViewModel.getEncryptionIndicatorTitle(props, snapshot);
        snapshot.sharedKeysUserId = EventTileViewModel.getSharedKeysUserId(props, snapshot);
        snapshot.sharedKeysRoomId = EventTileViewModel.getSharedKeysRoomId(props);
        snapshot.threadInfoMode = EventTileViewModel.getThreadInfoMode(props, snapshot);
        snapshot.tileClickMode = EventTileViewModel.getTileClickMode(props);
        snapshot.viewRoomMetricsTrigger = EventTileViewModel.getViewRoomMetricsTrigger(props);
        snapshot.classes = EventTileViewModel.getClasses(props, snapshot);
        return snapshot;
    }

    private static getDisplayInfo(props: EventTileViewModelProps): ReturnType<typeof getEventDisplayInfo> {
        return getEventDisplayInfo(props.cli, props.mxEvent, props.showHiddenEvents, this.shouldHideEvent(props));
    }

    private static isEligibleForSpecialReceipt(props: EventTileViewModelProps): boolean {
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

    private static getLineClasses(props: EventTileViewModelProps): string {
        const isProbablyMedia = MediaEventHelper.isEligible(props.mxEvent);

        return classNames("mx_EventTile_line", {
            mx_EventTile_mediaLine: isProbablyMedia,
            mx_EventTile_image:
                props.mxEvent.getType() === EventType.RoomMessage &&
                props.mxEvent.getContent().msgtype === MsgType.Image,
            mx_EventTile_sticker: props.mxEvent.getType() === EventType.Sticker,
            mx_EventTile_emote:
                props.mxEvent.getType() === EventType.RoomMessage &&
                props.mxEvent.getContent().msgtype === MsgType.Emote,
        });
    }

    private static getIsSending(props: EventTileViewModelProps): boolean {
        return ["sending", "queued", "encrypting"].includes(props.eventSendStatus ?? "");
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
                Boolean(snapshot.contextMenu)),
        );
    }

    private static getShowSender(props: EventTileViewModelProps): boolean {
        return !props.hideSender;
    }

    private static getShowThreadToolbar(props: EventTileViewModelProps): boolean {
        return props.timelineRenderingType === TimelineRenderingType.ThreadsList;
    }

    private static getShowThreadPanelSummary(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return (
            (props.timelineRenderingType === TimelineRenderingType.Notification ||
                props.timelineRenderingType === TimelineRenderingType.ThreadsList) &&
            Boolean(snapshot.thread)
        );
    }

    private static getShowReadReceipts(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return !snapshot.shouldShowSentReceipt && !snapshot.shouldShowSendingReceipt && Boolean(props.showReadReceipts);
    }

    private static getShowGroupPadlock(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return props.layout !== Layout.IRC && !snapshot.isBubbleMessage;
    }

    private static getShowIrcPadlock(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return props.layout === Layout.IRC && !snapshot.isBubbleMessage;
    }

    private static getShowLinkedTimestamp(props: EventTileViewModelProps): boolean {
        return props.timelineRenderingType !== TimelineRenderingType.Notification;
    }

    private static getShowDummyTimestamp(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): boolean {
        return props.layout === Layout.IRC && !snapshot.showTimestamp;
    }

    private static getShowRelativeTimestamp(props: EventTileViewModelProps): boolean {
        return props.timelineRenderingType === TimelineRenderingType.ThreadsList;
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

    private static getAvatarSize(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): string | null {
        const eventType = props.mxEvent.getType();

        if (props.timelineRenderingType === TimelineRenderingType.Notification) {
            return "24px";
        }

        if (snapshot.isInfoMessage) {
            return "14px";
        }

        if (
            props.timelineRenderingType === TimelineRenderingType.ThreadsList ||
            (props.timelineRenderingType === TimelineRenderingType.Thread && !props.continuation)
        ) {
            return "32px";
        }

        if (eventType === EventType.RoomCreate || snapshot.isBubbleMessage) {
            return null;
        }

        if (props.layout === Layout.IRC) {
            return "14px";
        }

        if (
            (props.continuation && props.timelineRenderingType !== TimelineRenderingType.File) ||
            eventType === EventType.CallInvite ||
            ElementCallEventType.matches(eventType)
        ) {
            return null;
        }

        if (props.timelineRenderingType === TimelineRenderingType.File) {
            return "20px";
        }

        return "30px";
    }

    private static getAvatarMemberUserOnClick(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): boolean {
        if (!snapshot.avatarSize) return false;
        if (!EventTileViewModel.getNeedsSenderProfile(props, snapshot)) return false;
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
        snapshot: EventTileViewSnapshot,
    ): EventTileViewSnapshot["senderMode"] {
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
        return snapshot.isPinned;
    }

    private static getEncryptionIndicatorMode(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): EventTileViewSnapshot["encryptionIndicatorMode"] {
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

    private static getEncryptionIndicatorTitle(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): string | undefined {
        const event = props.mxEvent.replacingEvent() ?? props.mxEvent;

        if (event.isDecryptionFailure()) {
            switch (event.decryptionFailureReason) {
                case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
                case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                    return undefined;
                default:
                    return _t("timeline|undecryptable_tooltip");
            }
        }

        if (snapshot.shieldColour !== EventShieldColour.NONE) {
            switch (snapshot.shieldReason) {
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

    private static getThreadInfoMode(
        props: EventTileViewModelProps,
        snapshot: EventTileViewSnapshot,
    ): EventTileViewSnapshot["threadInfoMode"] {
        if (snapshot.isThreadRoot && snapshot.thread) {
            return ThreadInfoMode.Summary;
        }

        if (props.timelineRenderingType === TimelineRenderingType.Search && props.mxEvent.threadRootId) {
            return props.highlightLink ? ThreadInfoMode.SearchLink : ThreadInfoMode.SearchText;
        }

        return ThreadInfoMode.None;
    }

    private static getTileClickMode(props: EventTileViewModelProps): EventTileViewSnapshot["tileClickMode"] {
        switch (props.timelineRenderingType) {
            case TimelineRenderingType.Notification:
                return ClickMode.ViewRoom;
            case TimelineRenderingType.ThreadsList:
                return ClickMode.ShowThread;
            default:
                return ClickMode.None;
        }
    }

    private static getViewRoomMetricsTrigger(
        props: EventTileViewModelProps,
    ): EventTileViewSnapshot["viewRoomMetricsTrigger"] {
        return props.timelineRenderingType === TimelineRenderingType.Search ? "MessageSearch" : undefined;
    }

    private static getClasses(props: EventTileViewModelProps, snapshot: EventTileViewSnapshot): string {
        const msgtype = props.mxEvent.getContent().msgtype;
        const eventType = props.mxEvent.getType();
        const isRenderingNotification = props.timelineRenderingType === TimelineRenderingType.Notification;

        return classNames({
            mx_EventTile_bubbleContainer: snapshot.isBubbleMessage,
            mx_EventTile_leftAlignedBubble: snapshot.isLeftAlignedBubbleMessage,
            mx_EventTile: true,
            mx_EventTile_isEditing: snapshot.isEditing,
            mx_EventTile_info: snapshot.isInfoMessage,
            mx_EventTile_12hr: props.isTwelveHour,
            mx_EventTile_sending: !snapshot.isEditing && snapshot.isSending,
            mx_EventTile_highlight: snapshot.isHighlighted,
            mx_EventTile_selected: props.isSelectedEvent || snapshot.contextMenu,
            mx_EventTile_continuation:
                snapshot.isContinuation ||
                eventType === EventType.CallInvite ||
                ElementCallEventType.matches(eventType),
            mx_EventTile_last: props.last,
            mx_EventTile_lastInSection: props.lastInSection,
            mx_EventTile_contextual: props.contextual,
            mx_EventTile_actionBarFocused: snapshot.actionBarFocused,
            mx_EventTile_bad: snapshot.isEncryptionFailure,
            mx_EventTile_emote: msgtype === MsgType.Emote,
            mx_EventTile_noSender: !snapshot.showSender,
            mx_EventTile_clamp:
                props.timelineRenderingType === TimelineRenderingType.ThreadsList || isRenderingNotification,
            mx_EventTile_noBubble: snapshot.noBubbleEvent,
        });
    }

    private getShouldShowSentReceipt(): boolean {
        return EventTileViewModel.getShouldShowSentReceipt(this.props);
    }

    private static getShouldShowSentReceipt(props: EventTileViewModelProps): boolean {
        if (!this.isEligibleForSpecialReceipt(props)) return false;
        if (!props.lastSuccessful) return false;
        if (props.timelineRenderingType === TimelineRenderingType.ThreadsList) return false;
        if (props.eventSendStatus && props.eventSendStatus !== EventStatus.SENT) return false;

        const receipts = props.readReceipts || [];
        const myUserId = props.cli.getUserId();
        if (receipts.some((receipt) => receipt.userId !== myUserId)) return false;

        return true;
    }

    private getShouldShowSendingReceipt(): boolean {
        return EventTileViewModel.getShouldShowSendingReceipt(this.props);
    }

    private static getShouldShowSendingReceipt(props: EventTileViewModelProps): boolean {
        if (!this.isEligibleForSpecialReceipt(props)) return false;
        if (!props.eventSendStatus || props.eventSendStatus === EventStatus.SENT) return false;
        return true;
    }

    private static getThread(props: EventTileViewModelProps): Thread | null {
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

    private getReactions(): Relations | null {
        return EventTileViewModel.getReactions(this.props);
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

    private getShouldHighlight(): boolean {
        return EventTileViewModel.getShouldHighlight(this.props);
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

    private onRoomReceipt = (_event: MatrixEvent, room: Room): void => {
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

    private onNewThread = (thread: Thread): void => {
        if (thread.id === this.props.mxEvent.getId()) {
            this.updateThread(thread);
            const roomId = this.props.mxEvent.getRoomId();
            const room = roomId ? this.props.cli.getRoom(roomId) : null;
            room?.off(ThreadEvent.New, this.onNewThread);
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
}
