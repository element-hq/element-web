/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    EventType,
    type Relations,
    type RelationType,
    type MatrixEvent,
    type RoomMember,
    type MatrixClient,
    EventStatus,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { CallErrorCode } from "matrix-js-sdk/src/webrtc/call";

import { TimelineRenderingType } from "../../../contexts/RoomContext";
import dis from "../../../dispatcher/dispatcher";
import { getEventDisplayInfo } from "../../../utils/EventRenderingUtils";
import { Layout } from "../../../settings/enums/Layout";
import { ElementCall } from "../../../models/Call";
import type { IReadReceiptPosition } from "../../views/rooms/ReadReceiptMarker";
import type EditorStateTransfer from "../../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";
import type { EventTileViewState } from "../../views/rooms/EventTileView";
import type { ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../dispatcher/actions";
import type ReplyChain from "../../views/elements/ReplyChain";
import { isEligibleForSpecialReceipt, type IEventTileType } from "../../views/rooms/EventTile";
import { getLateEventInfo } from "../../structures/grouper/LateEventGrouper";
import PinningUtils from "../../../utils/PinningUtils";
import { isMessageEvent } from "../../../events/EventTileFactory";
import { getSelectedText } from "../../../utils/strings";
import PlatformPeg from "../../../PlatformPeg";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { formatTime } from "../../../DateUtils";

export interface IReadReceiptProps {
    userId: string;
    roomMember: RoomMember | null;
    ts: number;
}

export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

export interface EventTileViewModelProps {
    // the MatrixEvent to show
    mxEvent: MatrixEvent;

    // true if mxEvent is redacted. This is a prop because using mxEvent.isRedacted()
    // might not be enough when deciding shouldComponentUpdate - prevProps.mxEvent
    // references the same this.props.mxEvent.
    isRedacted?: boolean;

    // true if this is a continuation of the previous event (which has the
    // effect of not showing another avatar/displayname
    isContinuation?: boolean;

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
    eventSendStatus?: string;

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

    // ref?: Ref<UnwrappedEventTile>;

    timelineRenderingType: TimelineRenderingType;
    showHiddenEvents: boolean;
    cli: MatrixClient;
}

function getMemberFromEvent(mxEvent: MatrixEvent): RoomMember | null {
    // set member to receiver (target) if it is a 3PID invite
    // so that the correct avatar is shown as the text is
    // `$target accepted the invitation for $email`
    if (mxEvent.getContent().third_party_invite) {
        return mxEvent.target;
    } else {
        return mxEvent.sender;
    }
}

function calculateAvatarSize(
    mxEvent: MatrixEvent,
    info: ReturnType<typeof getEventDisplayInfo>,
    timelineRenderingType: TimelineRenderingType,
    showHiddenEvents: boolean,
    isContinuation: boolean | undefined,
    layout: Layout | undefined,
): { avatarSize: string | null; needsSenderProfile: boolean } {
    const eventType = mxEvent.getType();
    const isRenderingNotification = timelineRenderingType === TimelineRenderingType.Notification;
    if (isRenderingNotification) {
        return { avatarSize: "24px", needsSenderProfile: true };
    } else if (info.isInfoMessage) {
        // a small avatar, with no sender profile, for
        // joins/parts/etc
        return { avatarSize: "14px", needsSenderProfile: false };
    } else if (
        timelineRenderingType === TimelineRenderingType.ThreadsList ||
        (timelineRenderingType === TimelineRenderingType.Thread && !isContinuation)
    ) {
        return { avatarSize: "32px", needsSenderProfile: true };
    } else if (eventType === EventType.RoomCreate || info.isBubbleMessage) {
        return { avatarSize: null, needsSenderProfile: false };
    } else if (layout === Layout.IRC) {
        return { avatarSize: "14px", needsSenderProfile: true };
    } else if (
        (isContinuation && timelineRenderingType !== TimelineRenderingType.File) ||
        eventType === EventType.CallInvite ||
        ElementCall.CALL_EVENT_TYPE.matches(eventType)
    ) {
        // no avatar or sender profile for continuation messages and call tiles
        return { avatarSize: null, needsSenderProfile: false };
    } else if (timelineRenderingType === TimelineRenderingType.File) {
        return { avatarSize: "20px", needsSenderProfile: true };
    } else {
        return { avatarSize: "30px", needsSenderProfile: true };
    }
}

export abstract class ViewModel<Props, ViewState> {
    private updates: CallableFunction[] = [];
    protected state: ViewState;

    public constructor(protected props: Props) {
        this.state = this.generateInitialState();
    }

    public getSnapshot = (): ViewState => {
        return this.state;
    };

    public subscribe = (update: CallableFunction): (() => void) => {
        this.updates = [...this.updates, update];
        return () => {
            this.updates = this.updates.filter((u) => u !== update);
            this.destroy();
        };
    };

    public get viewState(): ViewState {
        return this.state;
    }

    public destroy(): void {
        /* no-op */
    }

    protected setState(newState: ViewState): void {
        this.state = newState;
        for (const update of this.updates) {
            update();
        }
    }

    protected abstract generateInitialState(): ViewState;

    // should be called by react hook
    public onComponentMounted(): void {
        /* no-op */
    }
}

export class EventTileViewModel extends ViewModel<EventTileViewModelProps, EventTileViewState> {
    private tileRef = new TrackedRef<IEventTileType>();
    private replyChainRef = new TrackedRef<ReplyChain>();
    private actionBarFocused = false;
    private isQuoteExpanded = false;
    private suppressReadReceiptAnimation = true;
    private hover = false;
    private contextMenu: EventTileViewState["contextMenu"];
    private reactions?: Relations | null;

    public constructor(protected props: EventTileViewModelProps) {
        super({ ...props, isContinuation: props.isContinuation ?? false });
    }

    public onComponentMounted(): void {
        // todo: shouldn't this actually emit?
        this.suppressReadReceiptAnimation = false;
    }

    protected generateInitialState(): EventTileViewState {
        return this.generateState();
    }

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

    private onSenderProfileClick(): void {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: this.props.mxEvent.getSender()!,
            timelineRenderingType: this.props.timelineRenderingType,
        });
    }

    private getTile(): IEventTileType | null {
        return this.tileRef.current;
    }

    private getReplyChain(): ReplyChain | null {
        return this.replyChainRef.current;
    }

    private onActionBarFocusChange(actionBarFocused: boolean): void {
        this.actionBarFocused = actionBarFocused;
        this.setState({ ...this.viewState, actionBarFocused: this.actionBarFocused });
    }

    private setQuoteExpanded(expanded: boolean): void {
        this.isQuoteExpanded = expanded;
        this.setState({ ...this.viewState, isQuoteExpanded: this.isQuoteExpanded });
    }

    private onTimestampContextMenu = (ev: React.MouseEvent): void => {
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

        // Return if we're in a browser and click either an a tag or we have
        // selected text, as in those cases we want to use the native browser
        // menu
        if (!PlatformPeg.get()?.allowOverridingNativeContextMenus() && (getSelectedText() || anchorElement)) return;

        // We don't want to show the menu when editing a message
        if (this.props.editState) return;

        ev.preventDefault();
        ev.stopPropagation();
        this.contextMenu = {
            position: {
                left: ev.clientX,
                top: ev.clientY,
                bottom: ev.clientY,
            },
            link: anchorElement?.href || permalink,
        };
        this.actionBarFocused = true;
        this.setState({
            ...this.state,
            contextMenu: {
                position: {
                    left: ev.clientX,
                    top: ev.clientY,
                    bottom: ev.clientY,
                },
                link: anchorElement?.href || permalink,
            },
            actionBarFocused: true,
        });
    }

    private onPermalinkClicked = (e: React.MouseEvent): void => {
        // This allows the permalink to be opened in a new tab/window or copied as
        // matrix.to, but also for it to enable routing within Element when clicked.
        e.preventDefault();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
            metricsTrigger:
                this.props.timelineRenderingType === TimelineRenderingType.Search ? "MessageSearch" : undefined,
        });
    };

    /**
     * When true, the tile qualifies for some sort of special read receipt. This could be a 'sending'
     * or 'sent' receipt, for example.
     * @returns {boolean}
     */
    private get isEligibleForSpecialReceipt(): boolean {
        // First, if there are other read receipts then just short-circuit this.
        if (this.props.readReceipts && this.props.readReceipts.length > 0) return false;
        if (!this.props.mxEvent) return false;

        // Sanity check (should never happen, but we shouldn't explode if it does)
        const room = this.props.cli.getRoom(this.props.mxEvent.getRoomId());
        if (!room) return false;

        // Quickly check to see if the event was sent by us. If it wasn't, it won't qualify for
        // special read receipts.
        const myUserId = this.props.cli.getSafeUserId();
        // Check to see if the event was sent by us. If it wasn't, it won't qualify for special read receipts.
        if (this.props.mxEvent.getSender() !== myUserId) return false;
        return isEligibleForSpecialReceipt(this.props.mxEvent);
    }

    private get shouldShowSentReceipt(): boolean {
        // If we're not even eligible, don't show the receipt.
        if (!this.isEligibleForSpecialReceipt) return false;

        // We only show the 'sent' receipt on the last successful event.
        if (!this.props.lastSuccessful) return false;

        // Check to make sure the sending state is appropriate. A null/undefined send status means
        // that the message is 'sent', so we're just double checking that it's explicitly not sent.
        if (this.props.eventSendStatus && this.props.eventSendStatus !== EventStatus.SENT) return false;

        // If anyone has read the event besides us, we don't want to show a sent receipt.
        const receipts = this.props.readReceipts || [];
        const myUserId = this.props.cli.getUserId();
        if (receipts.some((r) => r.userId !== myUserId)) return false;

        // Finally, we should show a receipt.
        return true;
    }

    private get shouldShowSendingReceipt(): boolean {
        // If we're not even eligible, don't show the receipt.
        if (!this.isEligibleForSpecialReceipt) return false;

        // Check the event send status to see if we are pending. Null/undefined status means the
        // message was sent, so check for that and 'sent' explicitly.
        if (!this.props.eventSendStatus || this.props.eventSendStatus === EventStatus.SENT) return false;

        // Default to showing - there's no other event properties/behaviours we care about at
        // this point.
        return true;
    }

    private generateState(): EventTileViewState {
        const {
            timelineRenderingType,
            mxEvent,
            cli,
            showHiddenEvents,
            isContinuation,
            layout,
            inhibitInteraction,
            hideSender,
        } = this.props;

        const member = getMemberFromEvent(mxEvent);

        // In the ThreadsList view we use the entire EventTile as a click target to open the thread instead
        const viewUserOnClick =
            !inhibitInteraction &&
            ![TimelineRenderingType.ThreadsList, TimelineRenderingType.Notification].includes(timelineRenderingType);

        const forceHistorical = mxEvent.getType() === EventType.RoomMember;

        const info = getEventDisplayInfo(cli, mxEvent, showHiddenEvents, this.shouldHideEvent());
        const { avatarSize, needsSenderProfile } = calculateAvatarSize(
            mxEvent,
            info,
            timelineRenderingType,
            showHiddenEvents,
            isContinuation,
            layout,
        );

        const eventType = mxEvent.getType();
        const hasNoRenderer = !info.hasRenderer;
        if (hasNoRenderer) {
            // This shouldn't happen: the caller should check we support this type
            // before trying to instantiate us
            logger.warn(`Event type not supported: type:${eventType} isState:${mxEvent.isState()}`);
        }

        const shouldRender = needsSenderProfile && hideSender !== true;
        const senderProfileInfo: EventTileViewState["senderProfileInfo"] = {
            shouldRender,
            onClick: undefined,
            tooltip: undefined,
        };
        if (shouldRender) {
            if (
                [
                    TimelineRenderingType.Room,
                    TimelineRenderingType.Search,
                    TimelineRenderingType.Pinned,
                    TimelineRenderingType.Thread,
                ].includes(timelineRenderingType)
            ) {
                senderProfileInfo.onClick = () => this.onSenderProfileClick();
            } else if (timelineRenderingType === TimelineRenderingType.ThreadsList) {
                senderProfileInfo.tooltip = true;
            }
        }

        const isEditing = !!this.props.editState;
        const showMessageActionBar = !isEditing && !this.props.forExport;
        const permalinkCreator = this.props.permalinkCreator;

        // timestamp vm

        // Thread panel shows the timestamp of the last reply in that thread
        let ts =
            this.props.timelineRenderingType !== TimelineRenderingType.ThreadsList
                ? this.props.mxEvent.getTs()
                : this.state.thread?.replyToEvent?.getTs();
        if (typeof ts !== "number") {
            // Fall back to something we can use
            ts = this.props.mxEvent.getTs();
        }
        const showTimestamp = Boolean(
            this.props.mxEvent.getTs() &&
                !this.props.hideTimestamp &&
                (this.props.alwaysShowTimestamps ||
                    this.props.last ||
                    this.hover ||
                    this.actionBarFocused ||
                    Boolean(this.contextMenu)) &&
                ts,
        );

        const needsPinnedMessageBadge = PinningUtils.isPinned(cli, mxEvent);

        const isRedacted = Boolean(isMessageEvent(this.props.mxEvent) && this.props.isRedacted);

        // If we have reactions or a pinned message badge, we need a footer
        const needsFooter = Boolean((!isRedacted && this.reactions) || needsPinnedMessageBadge);

        let permalink = "#";
        if (this.props.permalinkCreator) {
            permalink = this.props.permalinkCreator.forEvent(mxEvent.getId()!);
        }

        return {
            member,
            viewUserOnClick,
            forceHistorical,
            avatarSize,
            hasNoRenderer,
            senderProfileInfo,
            mxEvent,
            showMessageActionBar,

            // todo: This should be a state
            reactions: this.reactions,
            hover: this.hover,
            contextMenu: this.contextMenu,
            thread: null,

            permalinkCreator,
            getTile: () => this.getTile(),
            getReplyChain: () => this.getReplyChain(),
            getRelationsForEvent: this.props.getRelationsForEvent,

            onFocusChange: (menuDisplayed) => this.onActionBarFocusChange(menuDisplayed),
            actionBarFocused: this.actionBarFocused,

            isQuoteExpanded: this.isQuoteExpanded,
            toggleThreadExpanded: () => this.setQuoteExpanded(!this.isQuoteExpanded),

            timestampViewModel: {
                showRelative: this.props.timelineRenderingType === TimelineRenderingType.ThreadsList,
                showTwelveHour: this.props.isTwelveHour,
                shouldRender: showTimestamp,
                ts,
                receivedTs: getLateEventInfo(this.props.mxEvent)?.received_ts,
            },

            linkedTimestampViewModel: {
                hideTimestamp: this.props.hideTimestamp,
                permalink,
                ariaLabel: formatTime(new Date(this.props.mxEvent.getTs()), this.props.isTwelveHour),
                onContextMenu: (e) => {
                    this.onTimestampContextMenu(e);
                },
                onClick: (e) => {
                    this.onPermalinkClicked(e);
                },
            },

            needsPinnedMessageBadge,
            isRedacted,
            needsFooter,
            suppressReadReceiptAnimation: this.suppressReadReceiptAnimation,

            shouldShowSentReceipt: this.shouldShowSentReceipt,
            shouldShowSendingReceipt: this.shouldShowSendingReceipt,
            messageState: mxEvent.getAssociatedStatus(),

            checkUnmounting: this.props.checkUnmounting,
            readReceiptMap: this.props.readReceiptMap,
            readReceipts: this.props.readReceipts,
            showReadReceipts: this.props.showReadReceipts,
        };
    }
}

class TrackedRef<T> {
    private node: T | null = null;

    public ref = (node: T): (() => void) => {
        this.node = node;
        return () => {
            this.node = null;
        };
    };

    public get current(): T | null {
        return this.node;
    }
}
