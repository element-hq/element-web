/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import {
    EventType,
    MsgType,
    type Relations,
    type RelationType,
    type MatrixEvent,
    MatrixEventEvent,
    type RoomMember,
    type MatrixClient,
    EventStatus,
    type Thread,
    ThreadEvent,
    RoomEvent,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import { CallErrorCode } from "matrix-js-sdk/src/webrtc/call";
import {
    CryptoEvent,
    DecryptionFailureCode,
    EventShieldColour,
    EventShieldReason,
    type UserVerificationStatus,
} from "matrix-js-sdk/src/crypto-api";
import { BaseViewModel } from "@element-hq/web-shared-components";
import classNames from "classnames";
import { createRef, type MouseEvent } from "react";

import { TimelineRenderingType } from "../../../contexts/RoomContext";
import dis from "../../../dispatcher/dispatcher";
import { getEventDisplayInfo } from "../../../utils/EventRenderingUtils";
import { Layout } from "../../../settings/enums/Layout";
import { ElementCallEventType } from "../../../call-types";
import type { IReadReceiptPosition } from "../../views/rooms/ReadReceiptMarker";
import type EditorStateTransfer from "../../../utils/EditorStateTransfer";
import type { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";
import type { EventTileViewState, E2ePadlockData } from "../../views/rooms/EventTileView";
import type { ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import { Action } from "../../../dispatcher/actions";
import type ReplyChain from "../../views/elements/ReplyChain";
import { isEligibleForSpecialReceipt, type IEventTileType } from "../../views/rooms/EventTile";
import { objectHasDiff } from "../../../utils/objects";
import { getLateEventInfo } from "../../structures/grouper/LateEventGrouper";
import PinningUtils from "../../../utils/PinningUtils";
import { haveRendererForEvent, isMessageEvent } from "../../../events/EventTileFactory";
import { copyPlaintext, getSelectedText } from "../../../utils/strings";
import PlatformPeg from "../../../PlatformPeg";
import type { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { formatTime } from "../../../DateUtils";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { shouldDisplayReply } from "../../../utils/Reply";
import { DecryptionFailureTracker } from "../../../DecryptionFailureTracker";
import { isLocalRoom } from "../../../utils/localRoom/isLocalRoom";
import { _t } from "../../../languageHandler";
import { E2ePadlockIcon } from "../../views/rooms/EventTile/E2ePadlock";
import type { ButtonEvent } from "../../views/elements/AccessibleButton";
import type { ShowThreadPayload } from "../../../dispatcher/payloads/ShowThreadPayload";
import PosthogTrackers from "../../../PosthogTrackers";

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

    timelineRenderingType: TimelineRenderingType;
    showHiddenEvents: boolean;
    cli: MatrixClient;
}

/** Internal mutable state that drives snapshot recomputation when it changes. */
interface MutableState {
    hover: boolean;
    focusWithin: boolean;
    actionBarFocused: boolean;
    isQuoteExpanded: boolean;
    suppressReadReceiptAnimation: boolean;
    reactions?: Relations | null;
    contextMenu?: EventTileViewState["contextMenu"];
    thread: Thread | null;
    shieldColour: EventShieldColour;
    shieldReason: EventShieldReason | null;
    isListeningForReceipts: boolean;
}

const DEFAULT_MUTABLE_STATE: MutableState = {
    hover: false,
    focusWithin: false,
    actionBarFocused: false,
    isQuoteExpanded: false,
    suppressReadReceiptAnimation: true, // suppressed until after mount() to prevent animation on first render
    reactions: undefined,
    contextMenu: undefined,
    thread: null,
    shieldColour: EventShieldColour.NONE,
    shieldReason: null,
    isListeningForReceipts: false,
};

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
        ElementCallEventType.matches(eventType)
    ) {
        // no avatar or sender profile for continuation messages and call tiles
        return { avatarSize: null, needsSenderProfile: false };
    } else if (timelineRenderingType === TimelineRenderingType.File) {
        return { avatarSize: "20px", needsSenderProfile: true };
    } else {
        return { avatarSize: "30px", needsSenderProfile: true };
    }
}

/** Computes the timestamp sub-view-model from props and mutable state. */
function computeTimestampViewModel(
    props: EventTileViewModelProps,
    mutable: MutableState,
): EventTileViewState["timestampViewModel"] {
    let ts =
        props.timelineRenderingType !== TimelineRenderingType.ThreadsList
            ? props.mxEvent.getTs()
            : mutable.thread?.replyToEvent?.getTs();
    if (typeof ts !== "number") {
        ts = props.mxEvent.getTs();
    }

    const showTimestamp = Boolean(
        props.mxEvent.getTs() &&
            !props.hideTimestamp &&
            (props.alwaysShowTimestamps ||
                props.last ||
                mutable.hover ||
                mutable.focusWithin ||
                mutable.actionBarFocused ||
                Boolean(mutable.contextMenu)) &&
            ts,
    );

    return {
        showRelative: props.timelineRenderingType === TimelineRenderingType.ThreadsList,
        showTwelveHour: props.isTwelveHour,
        shouldRender: showTimestamp,
        ts,
        receivedTs: getLateEventInfo(props.mxEvent)?.received_ts,
    };
}

/** Fetches the reactions Relations for an event, if applicable. */
function getReactions(props: EventTileViewModelProps): Relations | null {
    if (!props.showReactions || !props.getRelationsForEvent) return null;
    const eventId = props.mxEvent.getId()!;
    return props.getRelationsForEvent(eventId, "m.annotation", "m.reaction") ?? null;
}

/** Computes receipt-related snapshot fields. */
function computeReceipts(props: EventTileViewModelProps): {
    shouldShowSentReceipt: boolean;
    shouldShowSendingReceipt: boolean;
} {
    const { mxEvent, cli } = props;

    const isEligible = (() => {
        if (props.readReceipts && props.readReceipts.length > 0) return false;
        const room = cli.getRoom(mxEvent.getRoomId());
        if (!room) return false;
        const myUserId = cli.getSafeUserId();
        if (mxEvent.getSender() !== myUserId) return false;
        return isEligibleForSpecialReceipt(mxEvent);
    })();

    const shouldShowSentReceipt = (() => {
        if (!isEligible) return false;
        if (!props.lastSuccessful) return false;
        if (props.eventSendStatus && props.eventSendStatus !== EventStatus.SENT) return false;
        const receipts = props.readReceipts || [];
        const myUserId = cli.getUserId();
        if (receipts.some((r) => r.userId !== myUserId)) return false;
        return true;
    })();

    const shouldShowSendingReceipt = (() => {
        if (!isEligible) return false;
        if (!props.eventSendStatus || props.eventSendStatus === EventStatus.SENT) return false;
        return true;
    })();

    return { shouldShowSentReceipt, shouldShowSendingReceipt };
}

/** Computes the E2E padlock data from the current event and shield state. */
function computeE2ePadlockData(
    mxEvent: MatrixEvent,
    cli: MatrixClient,
    shieldColour: EventShieldColour,
    shieldReason: EventShieldReason | null,
): E2ePadlockData {
    const ev = mxEvent.replacingEvent() ?? mxEvent;

    // No icon for local rooms
    if (isLocalRoom(ev.getRoomId()!)) return { kind: "none" };

    // Event could not be decrypted
    if (ev.isDecryptionFailure()) {
        switch (ev.decryptionFailureReason) {
            case DecryptionFailureCode.SENDER_IDENTITY_PREVIOUSLY_VERIFIED:
            case DecryptionFailureCode.UNSIGNED_SENDER_DEVICE:
                // These get their own icons from DecryptionFailureBody
                return { kind: "none" };
            default:
                return { kind: "decryption_failure" };
        }
    }

    // Key was forwarded to us — show a dedicated icon
    if (shieldReason === EventShieldReason.AUTHENTICITY_NOT_GUARANTEED) {
        const forwarder = mxEvent.getKeyForwardingUser();
        if (forwarder) {
            return { kind: "shared", keyForwardingUserId: forwarder, roomId: ev.getRoomId()! };
        }
    }

    // Shield colour is set — map reason to a translated label
    if (shieldColour !== EventShieldColour.NONE) {
        let title: string;
        switch (shieldReason) {
            case EventShieldReason.UNVERIFIED_IDENTITY:
                title = _t("encryption|event_shield_reason_unverified_identity");
                break;
            case EventShieldReason.UNSIGNED_DEVICE:
                title = _t("encryption|event_shield_reason_unsigned_device");
                break;
            case EventShieldReason.UNKNOWN_DEVICE:
                title = _t("encryption|event_shield_reason_unknown_device");
                break;
            case EventShieldReason.AUTHENTICITY_NOT_GUARANTEED:
                title = _t("encryption|event_shield_reason_authenticity_not_guaranteed");
                break;
            case EventShieldReason.MISMATCHED_SENDER_KEY:
                title = _t("encryption|event_shield_reason_mismatched_sender_key");
                break;
            case EventShieldReason.SENT_IN_CLEAR:
                title = _t("common|unencrypted");
                break;
            case EventShieldReason.VERIFICATION_VIOLATION:
                title = _t("timeline|decryption_failure|sender_identity_previously_verified");
                break;
            case EventShieldReason.MISMATCHED_SENDER:
                title = _t("encryption|event_shield_reason_mismatched_sender");
                break;
            default:
                title = _t("error|unknown");
                break;
        }
        const icon = shieldColour === EventShieldColour.GREY ? E2ePadlockIcon.Normal : E2ePadlockIcon.Warning;
        return { kind: "padlock", icon, title };
    }

    // If the room is encrypted and the event is in a pending state
    const room = cli.getRoom(ev.getRoomId() ?? "");
    const isRoomEncrypted = Boolean(room?.currentState.getStateEvents(EventType.RoomEncryption, ""));
    if (isRoomEncrypted) {
        if (ev.status === EventStatus.ENCRYPTING) return { kind: "none" };
        if (ev.status === EventStatus.NOT_SENT) {
            return { kind: "padlock", icon: E2ePadlockIcon.Warning, title: _t("common|unencrypted") };
        }
        if (ev.status) return { kind: "none" };
    }

    return { kind: "none" };
}

/** Computes the full snapshot from props and mutable state. */
function computeSnapshot(props: EventTileViewModelProps, mutable: MutableState): EventTileViewState {
    const { timelineRenderingType, mxEvent, cli, showHiddenEvents, isContinuation, layout, inhibitInteraction, hideSender } = props;

    // In the ThreadsList view we use the entire EventTile as a click target to open the thread instead
    const viewUserOnClick =
        !inhibitInteraction &&
        ![TimelineRenderingType.ThreadsList, TimelineRenderingType.Notification].includes(timelineRenderingType);

    const forceHistorical = mxEvent.getType() === EventType.RoomMember;

    const shouldHide = props.callEventGrouper?.hangupReason === CallErrorCode.Replaced;
    const info = getEventDisplayInfo(cli, mxEvent, showHiddenEvents, shouldHide);
    const { isBubbleMessage, isInfoMessage, isLeftAlignedBubbleMessage, noBubbleEvent, isSeeingThroughMessageHiddenForModeration } = info;
    const { avatarSize, needsSenderProfile } = calculateAvatarSize(
        mxEvent,
        info,
        timelineRenderingType,
        showHiddenEvents,
        isContinuation,
        layout,
    );

    const eventType = mxEvent.getType();
    const msgtype = mxEvent.getContent().msgtype;
    const hasNoRenderer = !info.hasRenderer;
    if (hasNoRenderer) {
        logger.warn(`Event type not supported: type:${eventType} isState:${mxEvent.isState()}`);
    }

    const shouldRender = needsSenderProfile && hideSender !== true;
    let hasClickHandler = false;
    let tooltip: boolean | undefined;

    if (shouldRender) {
        if (
            [
                TimelineRenderingType.Room,
                TimelineRenderingType.Search,
                TimelineRenderingType.Pinned,
                TimelineRenderingType.Thread,
            ].includes(timelineRenderingType)
        ) {
            hasClickHandler = true;
        } else if (timelineRenderingType === TimelineRenderingType.ThreadsList) {
            tooltip = true;
        }
    }

    const senderProfileInfo: EventTileViewState["senderProfileInfo"] = {
        shouldRender,
        hasClickHandler,
        tooltip,
    };

    const isEditing = !!props.editState;
    const showMessageActionBar = !isEditing && !props.forExport;

    const { shouldShowSentReceipt, shouldShowSendingReceipt } = computeReceipts(props);

    const needsPinnedMessageBadge = PinningUtils.isPinned(cli, mxEvent);
    const isRedacted = Boolean(isMessageEvent(mxEvent) && props.isRedacted);
    const needsFooter = Boolean((!isRedacted && mutable.reactions) || needsPinnedMessageBadge);

    let permalink = "#";
    if (props.permalinkCreator) {
        permalink = props.permalinkCreator.forEvent(mxEvent.getId()!);
    }

    // ── Outer wrapper classes (matching legacy EventTile) ───────────────────────
    const isSending = ["sending", "queued", "encrypting"].includes(props.eventSendStatus!);
    const isEncryptionFailure = mxEvent.isDecryptionFailure();

    // isContinuation may need to be overridden for non-room views
    let effectiveContinuation = isContinuation;
    if (
        timelineRenderingType !== TimelineRenderingType.Room &&
        timelineRenderingType !== TimelineRenderingType.Search &&
        timelineRenderingType !== TimelineRenderingType.Thread &&
        layout !== Layout.Bubble
    ) {
        effectiveContinuation = false;
    }

    const isRenderingNotification = timelineRenderingType === TimelineRenderingType.Notification;

    const shouldHighlight = (() => {
        if (props.forExport) return false;
        if (isRenderingNotification) return false;
        if (timelineRenderingType === TimelineRenderingType.ThreadsList) return false;
        if (props.isRedacted) return false;
        const actions = cli.getPushActionsForEvent(mxEvent.replacingEvent() || mxEvent);
        const previousActions = mxEvent.replacingEvent() ? cli.getPushActionsForEvent(mxEvent) : undefined;
        if (!actions?.tweaks && !previousActions?.tweaks) return false;
        if (mxEvent.getSender() === cli.credentials.userId) return false;
        return !!(actions?.tweaks.highlight || previousActions?.tweaks.highlight);
    })();

    const outerClasses = classNames({
        mx_EventTile_bubbleContainer: isBubbleMessage,
        mx_EventTile_leftAlignedBubble: isLeftAlignedBubbleMessage,
        mx_EventTile: true,
        mx_EventTile_isEditing: isEditing,
        mx_EventTile_info: isInfoMessage,
        mx_EventTile_12hr: props.isTwelveHour,
        mx_EventTile_sending: !isEditing && isSending,
        mx_EventTile_highlight: shouldHighlight,
        mx_EventTile_selected: props.isSelectedEvent || !!mutable.contextMenu,
        mx_EventTile_continuation:
            effectiveContinuation || eventType === EventType.CallInvite || ElementCallEventType.matches(eventType),
        mx_EventTile_last: props.last,
        mx_EventTile_lastInSection: props.lastInSection,
        mx_EventTile_contextual: props.contextual,
        mx_EventTile_actionBarFocused: mutable.actionBarFocused,
        mx_EventTile_bad: isEncryptionFailure,
        mx_EventTile_emote: msgtype === MsgType.Emote,
        mx_EventTile_noSender: hideSender,
        mx_EventTile_clamp: timelineRenderingType === TimelineRenderingType.ThreadsList || isRenderingNotification,
        mx_EventTile_noBubble: noBubbleEvent,
    });

    // ── Line classes ────────────────────────────────────────────────────────────
    const isProbablyMedia = MediaEventHelper.isEligible(mxEvent);
    const lineClasses = classNames("mx_EventTile_line", {
        mx_EventTile_mediaLine: isProbablyMedia,
        mx_EventTile_image: eventType === EventType.RoomMessage && msgtype === MsgType.Image,
        mx_EventTile_sticker: eventType === EventType.Sticker,
        mx_EventTile_emote: eventType === EventType.RoomMessage && msgtype === MsgType.Emote,
    });

    // ── Scroll token ────────────────────────────────────────────────────────────
    const scrollToken = mxEvent.status ? undefined : mxEvent.getId();

    // ── aria-live ───────────────────────────────────────────────────────────────
    const ariaLive = props.eventSendStatus !== null ? "off" : undefined;

    // ── Own event ───────────────────────────────────────────────────────────────
    const isOwnEvent = mxEvent.getSender() === cli.getUserId();

    // ── Reply chain ─────────────────────────────────────────────────────────────
    const shouldRenderReplyChain =
        haveRendererForEvent(mxEvent, cli, showHiddenEvents) && shouldDisplayReply(mxEvent);

    // ── Tile ID ─────────────────────────────────────────────────────────────────
    const tileId = `mx_EventTile_${mxEvent.getId()}`;

    return {
        viewUserOnClick,
        forceHistorical,
        avatarSize,
        hasNoRenderer,
        senderProfileInfo,
        mxEvent,
        showMessageActionBar,
        reactions: mutable.reactions,
        hover: mutable.hover,
        contextMenu: mutable.contextMenu,
        thread: mutable.thread,
        permalinkCreator: props.permalinkCreator,
        getRelationsForEvent: props.getRelationsForEvent,
        actionBarFocused: mutable.actionBarFocused,
        isQuoteExpanded: mutable.isQuoteExpanded,
        timestampViewModel: computeTimestampViewModel(props, mutable),
        linkedTimestampViewModel: {
            hideTimestamp: props.hideTimestamp,
            permalink,
            ariaLabel: formatTime(new Date(mxEvent.getTs()), props.isTwelveHour),
        },
        needsPinnedMessageBadge,
        isRedacted,
        needsFooter,
        suppressReadReceiptAnimation: mutable.suppressReadReceiptAnimation,
        shouldShowSentReceipt,
        shouldShowSendingReceipt,
        messageState: mxEvent.getAssociatedStatus(),
        checkUnmounting: props.checkUnmounting,
        readReceiptMap: props.readReceiptMap,
        readReceipts: props.readReceipts,
        showReadReceipts: props.showReadReceipts,
        tileProps: {
            timelineRenderingType: props.timelineRenderingType,
            isSeeingThroughMessageHiddenForModeration,
            highlights: props.highlights,
            highlightLink: props.highlightLink,
            showUrlPreview: props.showUrlPreview,
            forExport: props.forExport,
            editState: props.editState,
            replacingEventId: props.replacingEventId,
            callEventGrouper: props.callEventGrouper,
            inhibitInteraction: props.inhibitInteraction,
            showHiddenEvents: props.showHiddenEvents,
        },
        // New fields for outer wrapper parity
        outerClasses,
        lineClasses,
        scrollToken,
        ariaLive,
        isOwnEvent,
        as: props.as || "li",
        tileId,
        layout,
        shouldRenderReplyChain,
        e2ePadlockData: computeE2ePadlockData(mxEvent, cli, mutable.shieldColour, mutable.shieldReason),
        isBubbleMessage,
        eventSendStatus: props.eventSendStatus,
        replyChainProps: shouldRenderReplyChain
            ? {
                  forExport: props.forExport,
                  layout,
                  alwaysShowTimestamps: props.alwaysShowTimestamps,
              }
            : undefined,
        // Render-path fields
        timelineRenderingType: props.timelineRenderingType,
        showThreadInfo: props.showThreadInfo ?? true,
        isRenderingNotification,
        room: cli.getRoom(mxEvent.getRoomId() ?? "") ?? null,
    };
}

export class EventTileViewModel extends BaseViewModel<EventTileViewState, EventTileViewModelProps> {
    public readonly tileRef = createRef<IEventTileType | null>();
    public readonly replyChainRef = createRef<ReplyChain | null>();
    private mutable: MutableState;
    private mounted = false;

    public constructor(props: EventTileViewModelProps) {
        const normalizedProps = { ...props, isContinuation: props.isContinuation ?? false };
        const initialMutable = { ...DEFAULT_MUTABLE_STATE, reactions: getReactions(normalizedProps) };
        super(normalizedProps, computeSnapshot(normalizedProps, initialMutable));
        this.mutable = initialMutable;
    }

    /** Called by the view on mount to register event listeners and trigger initial async work. */
    public mount(): void {
        this.mounted = true;
        const { mxEvent, cli, forExport, showReactions } = this.props;

        if (!forExport) {
            cli.on(CryptoEvent.UserTrustStatusChanged, this.onUserVerificationChanged);
            mxEvent.on(MatrixEventEvent.Decrypted, this.onDecrypted);
            mxEvent.on(MatrixEventEvent.Replaced, this.onReplaced);
            DecryptionFailureTracker.instance.addVisibleEvent(mxEvent);

            if (showReactions) {
                mxEvent.on(MatrixEventEvent.RelationsCreated, this.onReactionsCreated);
            }

            if (this.isEligibleForReceiptListener()) {
                cli.on(RoomEvent.Receipt, this.onRoomReceipt);
                this.mutable.isListeningForReceipts = true;
            }
        }

        mxEvent.on(ThreadEvent.Update, this.onThreadUpdate);
        cli.decryptEventIfNeeded(mxEvent);

        const room = cli.getRoom(mxEvent.getRoomId());
        room?.on(ThreadEvent.New, this.onNewThread);

        this.mutable.suppressReadReceiptAnimation = false;
        this.snapshot.merge({
            suppressReadReceiptAnimation: false,
        });

        this.verifyEvent();
    }

    /** Called by the view on unmount to clean up event listeners. */
    public unmount(): void {
        this.mounted = false;
        const { mxEvent, cli, showReactions } = this.props;

        cli.removeListener(CryptoEvent.UserTrustStatusChanged, this.onUserVerificationChanged);
        mxEvent.removeListener(MatrixEventEvent.Decrypted, this.onDecrypted);
        mxEvent.removeListener(MatrixEventEvent.Replaced, this.onReplaced);

        if (showReactions) {
            mxEvent.removeListener(MatrixEventEvent.RelationsCreated, this.onReactionsCreated);
        }

        if (this.mutable.isListeningForReceipts) {
            cli.removeListener(RoomEvent.Receipt, this.onRoomReceipt);
            this.mutable.isListeningForReceipts = false;
        }

        mxEvent.off(ThreadEvent.Update, this.onThreadUpdate);

        const room = cli.getRoom(mxEvent.getRoomId());
        room?.off(ThreadEvent.New, this.onNewThread);
    }

    /** Called when the parent re-renders with new props. Recomputes the snapshot only if props changed. */
    public updateProps(newProps: EventTileViewModelProps): void {
        const normalizedProps = { ...newProps, isContinuation: newProps.isContinuation ?? false };
        if (!objectHasDiff(this.props, normalizedProps)) return;
        const prevStatus = this.props.eventSendStatus;
        this.props = normalizedProps;
        this.snapshot.set(computeSnapshot(normalizedProps, this.mutable));

        // Re-verify E2EE when the send status changes (outgoing events progress through the send process)
        if (prevStatus !== newProps.eventSendStatus) {
            this.verifyEvent();
        }

        // Subscribe to receipts if we now qualify and aren't already
        if (!this.mutable.isListeningForReceipts && this.isEligibleForReceiptListener()) {
            newProps.cli.on(RoomEvent.Receipt, this.onRoomReceipt);
            this.mutable.isListeningForReceipts = true;
        }
    }

    // ── Public actions (called directly from the view, not via snapshot) ────────

    /** Returns the current rendered tile component instance, if any. */
    public getTile = (): IEventTileType | null => this.tileRef.current;

    /** Returns the current reply chain component instance, if any. */
    public getReplyChain = (): ReplyChain | null => this.replyChainRef.current;

    /** Called by the action bar when its focus state changes. */
    public onFocusChange = (menuDisplayed: boolean): void => {
        this.mutable.actionBarFocused = menuDisplayed;
        this.snapshot.merge({
            actionBarFocused: menuDisplayed,
            timestampViewModel: computeTimestampViewModel(this.props, this.mutable),
        });
    };

    /** Called when mouse enters the tile. */
    public onHoverStart = (): void => {
        this.mutable.hover = true;
        this.snapshot.merge({
            hover: true,
            timestampViewModel: computeTimestampViewModel(this.props, this.mutable),
        });
    };

    /** Called when mouse leaves the tile. */
    public onHoverEnd = (): void => {
        this.mutable.hover = false;
        this.snapshot.merge({
            hover: false,
            timestampViewModel: computeTimestampViewModel(this.props, this.mutable),
        });
    };

    /** Called when the tile receives focus. */
    public onFocusStart = (): void => {
        this.mutable.focusWithin = true;
        this.snapshot.merge({
            timestampViewModel: computeTimestampViewModel(this.props, this.mutable),
        });
    };

    /** Called when focus leaves the tile. */
    public onFocusEnd = (): void => {
        this.mutable.focusWithin = false;
        this.snapshot.merge({
            timestampViewModel: computeTimestampViewModel(this.props, this.mutable),
        });
    };

    /** Called on right-click / context menu request on the tile. */
    public onContextMenu = (ev: MouseEvent): void => {
        this.showContextMenu(ev);
    };

    /** Closes the open context menu. */
    public onCloseMenu = (): void => {
        this.mutable.contextMenu = undefined;
        this.mutable.actionBarFocused = false;
        this.snapshot.merge({
            contextMenu: undefined,
            actionBarFocused: false,
            timestampViewModel: computeTimestampViewModel(this.props, this.mutable),
        });
    };

    /** Toggles expansion of the quote/reply thread. */
    public toggleThreadExpanded = (): void => {
        this.mutable.isQuoteExpanded = !this.mutable.isQuoteExpanded;
        this.snapshot.merge({ isQuoteExpanded: this.mutable.isQuoteExpanded });
    };

    /** Inserts the sender's user ID into the composer. */
    public onSenderProfileClick = (): void => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            userId: this.props.mxEvent.getSender()!,
            timelineRenderingType: this.props.timelineRenderingType,
        });
    };

    /** Opens a context menu anchored to the timestamp. */
    public onTimestampContextMenu = (ev: MouseEvent): void => {
        this.showContextMenu(ev, this.props.permalinkCreator?.forEvent(this.props.mxEvent.getId()!));
    };

    /** Navigates to the event's permalink within Element. */
    public onPermalinkClicked = (e: MouseEvent): void => {
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

    /** Navigates to this event's room, highlighting the event. */
    public viewInRoom = (evt: ButtonEvent): void => {
        evt.preventDefault();
        evt.stopPropagation();
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
            metricsTrigger: undefined, // room doesn't change
        });
    };

    /** Copies the thread permalink to clipboard. */
    public copyLinkToThread = async (evt: ButtonEvent): Promise<void> => {
        evt.preventDefault();
        evt.stopPropagation();
        const { permalinkCreator, mxEvent } = this.props;
        if (!permalinkCreator) return;
        const matrixToUrl = permalinkCreator.forEvent(mxEvent.getId()!);
        await copyPlaintext(matrixToUrl);
    };

    /** Handles click on a Notification or ThreadsList tile (opens room or thread accordingly). */
    public onNotificationClick = (ev: MouseEvent): void => {
        const target = ev.currentTarget as HTMLElement;
        let index = -1;
        if (target.parentElement) index = Array.from(target.parentElement.children).indexOf(target);

        switch (this.props.timelineRenderingType) {
            case TimelineRenderingType.Notification:
                this.viewInRoom(ev as unknown as ButtonEvent);
                break;
            case TimelineRenderingType.ThreadsList:
                dis.dispatch<ShowThreadPayload>({
                    action: Action.ShowThread,
                    rootEvent: this.props.mxEvent,
                    push: true,
                });
                PosthogTrackers.trackInteraction("WebThreadsPanelThreadItem", ev, index);
                break;
        }
    };

    // ── Private async helpers ───────────────────────────────────────────────────

    private verifyEvent(): void {
        this.doVerifyEvent().catch((e) => {
            const event = this.props.mxEvent;
            logger.error(`Error getting encryption info on event ${event.getId()} in room ${event.getRoomId()}`, e);
        });
    }

    private async doVerifyEvent(): Promise<void> {
        const mxEvent = this.props.mxEvent.replacingEvent() ?? this.props.mxEvent;

        if (!mxEvent.isEncrypted() || mxEvent.isRedacted()) {
            this.mutable.shieldColour = EventShieldColour.NONE;
            this.mutable.shieldReason = null;
            this.snapshot.merge({
                e2ePadlockData: computeE2ePadlockData(this.props.mxEvent, this.props.cli, this.mutable.shieldColour, this.mutable.shieldReason),
            });
            return;
        }

        const encryptionInfo =
            (await this.props.cli.getCrypto()?.getEncryptionInfoForEvent(mxEvent)) ?? null;
        if (!this.mounted) return;

        if (encryptionInfo === null) {
            // likely a decryption error
            this.mutable.shieldColour = EventShieldColour.NONE;
            this.mutable.shieldReason = null;
        } else {
            this.mutable.shieldColour = encryptionInfo.shieldColour;
            this.mutable.shieldReason = encryptionInfo.shieldReason;
        }
        this.snapshot.merge({
            e2ePadlockData: computeE2ePadlockData(this.props.mxEvent, this.props.cli, this.mutable.shieldColour, this.mutable.shieldReason),
        });
    }

    private isEligibleForReceiptListener(): boolean {
        const { mxEvent, cli } = this.props;
        if (!mxEvent) return false;
        const myUserId = cli.getSafeUserId();
        if (mxEvent.getSender() !== myUserId) return false;
        return isEligibleForSpecialReceipt(mxEvent);
    }

    // ── Event handlers ──────────────────────────────────────────────────────────

    private onDecrypted = (): void => {
        this.verifyEvent();
        this.snapshot.set(computeSnapshot(this.props, this.mutable));
    };

    private onUserVerificationChanged = (userId: string, _trustStatus: UserVerificationStatus): void => {
        if (userId === this.props.mxEvent.getSender()) {
            this.verifyEvent();
        }
    };

    private onReplaced = (): void => {
        this.verifyEvent();
    };

    private onThreadUpdate = (thread: Thread): void => {
        this.mutable.thread = thread;
        this.snapshot.merge({
            thread,
            timestampViewModel: computeTimestampViewModel(this.props, this.mutable),
        });
    };

    private onNewThread = (thread: Thread): void => {
        if (thread.id === this.props.mxEvent.getId()) {
            this.onThreadUpdate(thread);
            const room = this.props.cli.getRoom(this.props.mxEvent.getRoomId());
            room?.off(ThreadEvent.New, this.onNewThread);
        }
    };

    private onReactionsCreated = (relationType: string, eventType: string): void => {
        if (relationType !== "m.annotation" || eventType !== "m.reaction") return;
        const reactions = getReactions(this.props);
        this.mutable.reactions = reactions;
        const isRedacted = Boolean(isMessageEvent(this.props.mxEvent) && this.props.isRedacted);
        const needsPinnedMessageBadge = PinningUtils.isPinned(this.props.cli, this.props.mxEvent);
        this.snapshot.merge({
            reactions,
            needsFooter: Boolean((!isRedacted && reactions) || needsPinnedMessageBadge),
        });
    };

    private onRoomReceipt = (): void => {
        this.snapshot.merge(computeReceipts(this.props));
    };

    // ── Private helpers ─────────────────────────────────────────────────────────

    private showContextMenu(ev: MouseEvent, permalink?: string): void {
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

        this.mutable.contextMenu = {
            position: { left: ev.clientX, top: ev.clientY, bottom: ev.clientY },
            link: anchorElement?.href || permalink,
        };
        this.mutable.actionBarFocused = true;

        this.snapshot.merge({
            contextMenu: this.mutable.contextMenu,
            actionBarFocused: true,
            timestampViewModel: computeTimestampViewModel(this.props, this.mutable),
        });
    }
}
