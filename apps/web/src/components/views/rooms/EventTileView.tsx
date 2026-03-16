/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { useViewModel } from "@element-hq/web-shared-components";
import { ThreadsIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import type {
    EventStatus,
    EventType,
    MatrixEvent,
    Relations,
    RelationType,
    Room,
    Thread,
} from "matrix-js-sdk/src/matrix";
import type { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { SentReceipt, MessageTimestampWrapper, ReactionsRowWrapper, DecryptionFailureBodyWrapper } from "./EventTile";
import type { IReadReceiptPosition } from "./ReadReceiptMarker";
import type { EventTileViewModel, IReadReceiptProps } from "../../viewmodels/rooms/EventTileViewModel";
import { _t } from "../../../languageHandler";
import MemberAvatar from "../avatars/MemberAvatar";
import SenderProfile from "../messages/SenderProfile";
import MessageActionBar from "../messages/MessageActionBar";
import { PinnedMessageBadge } from "../messages/PinnedMessageBadge";
import { ReadReceiptGroup } from "./ReadReceiptGroup";
import { renderTile } from "../../../events/EventTileFactory";
import { TimelineRenderingType } from "../../../contexts/RoomContext";
import type EditorStateTransfer from "../../../utils/EditorStateTransfer";
import type LegacyCallEventGrouper from "../../structures/LegacyCallEventGrouper";
import { Layout } from "../../../settings/enums/Layout";
import ReplyChain from "../elements/ReplyChain";
import MessageContextMenu from "../context_menus/MessageContextMenu";
import { aboveRightOf } from "../../structures/ContextMenu";
import { E2ePadlock, E2ePadlockIcon } from "./EventTile/E2ePadlock.tsx";
import { E2eMessageSharedIcon } from "./EventTile/E2eMessageSharedIcon.tsx";
import ThreadSummary, { ThreadMessagePreview } from "./ThreadSummary";
import { EventTileThreadToolbar } from "./EventTile/EventTileThreadToolbar";
import { EventPreview } from "./EventPreview";
import RedactedBody from "../messages/RedactedBody";
import { UnreadNotificationBadge } from "./NotificationBadge/UnreadNotificationBadge";
import RoomAvatar from "../avatars/RoomAvatar";

/** Discriminated union for E2E padlock rendering. */
export type E2ePadlockData =
    | { kind: "none" }
    | { kind: "decryption_failure" }
    | { kind: "shared"; keyForwardingUserId: string; roomId: string }
    | { kind: "padlock"; icon: E2ePadlockIcon; title: string };

interface IProps {
    vm: EventTileViewModel;
}

export type GetRelationsForEvent = (
    eventId: string,
    relationType: RelationType | string,
    eventType: EventType | string,
) => Relations | null | undefined;

export interface EventTileViewState {
    avatarSize: string | null;
    viewUserOnClick: boolean;
    forceHistorical: boolean;
    senderProfileInfo: {
        shouldRender: boolean;
        /** Whether there is a click handler for the sender profile (the actual handler is on the vm). */
        hasClickHandler: boolean;
        tooltip?: boolean;
    };
    hasNoRenderer: boolean;
    mxEvent: MatrixEvent;
    showMessageActionBar: boolean;
    // The Relations model from the JS SDK for reactions to `mxEvent`
    reactions?: Relations | null;
    permalinkCreator?: RoomPermalinkCreator;
    getRelationsForEvent?: GetRelationsForEvent;
    actionBarFocused: boolean;
    isQuoteExpanded?: boolean;

    timestampViewModel: {
        shouldRender: boolean;
        showRelative?: boolean;
        showTwelveHour?: boolean;
        ts: number;
        receivedTs?: number;
    };

    hover: boolean;
    contextMenu?: {
        position: Pick<DOMRect, "top" | "left" | "bottom">;
        link?: string;
    };
    thread: Thread | null;

    needsPinnedMessageBadge: boolean;
    isRedacted: boolean;
    needsFooter: boolean;

    linkedTimestampViewModel: {
        hideTimestamp?: boolean;
        permalink: string;
        ariaLabel?: string;
    };

    suppressReadReceiptAnimation: boolean;

    shouldShowSentReceipt: boolean;
    shouldShowSendingReceipt: boolean;
    messageState: EventStatus | null;

    readReceipts?: IReadReceiptProps[];
    readReceiptMap?: { [userId: string]: IReadReceiptPosition };
    checkUnmounting?: () => boolean;
    showReadReceipts?: boolean;

    /** All props needed to render the actual tile content via renderTile(). */
    tileProps: {
        timelineRenderingType: TimelineRenderingType;
        isSeeingThroughMessageHiddenForModeration?: boolean;
        highlights?: string[];
        highlightLink?: string;
        showUrlPreview?: boolean;
        forExport?: boolean;
        editState?: EditorStateTransfer;
        replacingEventId?: string;
        callEventGrouper?: LegacyCallEventGrouper;
        inhibitInteraction?: boolean;
        showHiddenEvents: boolean;
    };

    // ── Outer wrapper fields ────────────────────────────────────────────────────
    /** CSS classes for the outer <li> wrapper. */
    outerClasses: string;
    /** CSS classes for the mx_EventTile_line div. */
    lineClasses: string;
    /** Scroll token (event ID) for scroll-position anchoring. Undefined for local echoes. */
    scrollToken?: string;
    /** aria-live attribute for the outer element. */
    ariaLive?: string;
    /** Whether this event was sent by the current user. */
    isOwnEvent: boolean;
    /** The `as` element for the outer wrapper (default "li"). */
    as: string;
    /** A stable ID for the line div (used for aria-describedby). */
    tileId: string;
    /** Layout mode. */
    layout?: Layout;
    /** Whether the reply chain should be rendered. */
    shouldRenderReplyChain: boolean;
    /** E2E padlock display data. */
    e2ePadlockData: E2ePadlockData;
    /** Whether this is a bubble message. */
    isBubbleMessage: boolean;
    /** Event send status string. */
    eventSendStatus?: string;
    /** Props for ReplyChain. */
    replyChainProps?: {
        forExport?: boolean;
        layout?: Layout;
        alwaysShowTimestamps?: boolean;
    };

    // ── Render-path fields ─────────────────────────────────────────────────────
    /** The current timeline rendering type (determines which render path to use). */
    timelineRenderingType: TimelineRenderingType;
    /** Whether to show thread info (ThreadSummary / search thread link). */
    showThreadInfo: boolean;
    /** Convenience flag: true when rendering in the Notification panel. */
    isRenderingNotification: boolean;
    /** The room this event belongs to (used in Notification / ThreadsList layouts). */
    room: Room | null;
}

const NoRendererView: React.FC = () => {
    return (
        <div className="mx_EventTile mx_EventTile_info mx_MNoticeBody">
            <div className="mx_EventTile_line">{_t("timeline|error_no_renderer")}</div>
        </div>
    );
};

const EventTileAvatarView: React.FC<{ vs: EventTileViewState }> = ({ vs }) => {
    if (!vs.avatarSize) return null;
    // For 3PID invites, the correct avatar is the invite target, not the sender
    const member = vs.mxEvent.getContent().third_party_invite ? vs.mxEvent.target : vs.mxEvent.sender;
    const fallbackUserId = vs.mxEvent.getSender() ?? undefined;
    if (!member && !fallbackUserId) return null;
    return (
        <div className="mx_EventTile_avatar">
            <MemberAvatar
                member={member}
                fallbackUserId={fallbackUserId}
                size={vs.avatarSize}
                viewUserOnClick={vs.viewUserOnClick}
                forceHistorical={vs.forceHistorical}
            />
        </div>
    );
};

/** Renders the appropriate E2E padlock icon based on the padlock data from the VM. */
const E2ePadlockView: React.FC<{ data: E2ePadlockData }> = ({ data }) => {
    switch (data.kind) {
        case "none":
            return null;
        case "decryption_failure":
            return <E2ePadlock title={_t("timeline|undecryptable_tooltip")} icon={E2ePadlockIcon.DecryptionFailure} />;
        case "shared":
            return <E2eMessageSharedIcon keyForwardingUserId={data.keyForwardingUserId} roomId={data.roomId} />;
        case "padlock":
            return <E2ePadlock icon={data.icon} title={data.title} />;
    }
};

export const EventTileView: React.FC<IProps> = ({ vm }) => {
    const vs = useViewModel(vm);
    const replyChainRef = vm.replyChainRef;

    if (vs.hasNoRenderer) {
        logger.warn(`Event type not supported: `);
        return <NoRendererView />;
    }

    // ── Avatar ──────────────────────────────────────────────────────────────────
    const avatar = <EventTileAvatarView vs={vs} />;

    // ── Sender ──────────────────────────────────────────────────────────────────
    let sender: React.JSX.Element | null = null;
    const senderProfileInfo = vs.senderProfileInfo;
    if (senderProfileInfo.shouldRender) {
        sender = (
            <SenderProfile
                mxEvent={vs.mxEvent}
                onClick={senderProfileInfo.hasClickHandler ? vm.onSenderProfileClick : undefined}
                withTooltip={senderProfileInfo.tooltip}
            />
        );
    }

    // ── Tile content (the actual message body) ──────────────────────────────────
    const tileContent = renderTile(vs.tileProps.timelineRenderingType, {
        ...vs.tileProps,
        mxEvent: vs.mxEvent,
        permalinkCreator: vs.permalinkCreator,
        getRelationsForEvent: vs.getRelationsForEvent,
        ref: vm.tileRef,
    });

    // ── Action bar ──────────────────────────────────────────────────────────────
    let actionBar: React.JSX.Element | null = null;
    if (vs.showMessageActionBar) {
        actionBar = (
            <MessageActionBar
                mxEvent={vs.mxEvent}
                reactions={vs.reactions}
                permalinkCreator={vs.permalinkCreator}
                getTile={vm.getTile}
                getReplyChain={vm.getReplyChain}
                onFocusChange={vm.onFocusChange}
                isQuoteExpanded={vs.isQuoteExpanded}
                toggleThreadExpanded={vm.toggleThreadExpanded}
                getRelationsForEvent={vs.getRelationsForEvent}
            />
        );
    }

    // ── Timestamp ───────────────────────────────────────────────────────────────
    const timestampVm = vs.timestampViewModel;
    const messageTimestamp = timestampVm.shouldRender ? (
        <MessageTimestampWrapper
            showRelative={timestampVm.showRelative}
            showTwelveHour={timestampVm.showTwelveHour}
            ts={timestampVm.ts}
            receivedTs={timestampVm.receivedTs}
        />
    ) : null;

    const useIRCLayout = vs.layout === Layout.IRC;
    const dummyTimestamp = useIRCLayout ? <span className="mx_MessageTimestamp" /> : null;

    const linkedTimestampVm = vs.linkedTimestampViewModel;
    const linkedMessageTimestamp = (
        <MessageTimestampWrapper
            showRelative={timestampVm.showRelative}
            showTwelveHour={timestampVm.showTwelveHour}
            ts={timestampVm.ts}
            receivedTs={timestampVm.receivedTs}
            href={linkedTimestampVm.permalink}
            onClick={vm.onPermalinkClicked}
            onContextMenu={vm.onTimestampContextMenu}
        />
    );
    const linkedTimestamp =
        messageTimestamp && !linkedTimestampVm.hideTimestamp ? linkedMessageTimestamp : dummyTimestamp;

    const groupTimestamp = !useIRCLayout ? linkedTimestamp : null;
    const ircTimestamp = useIRCLayout ? linkedTimestamp : null;

    // ── E2E padlock ─────────────────────────────────────────────────────────────
    const padlock = <E2ePadlockView data={vs.e2ePadlockData} />;
    const groupPadlock = !useIRCLayout && !vs.isBubbleMessage ? padlock : null;
    const ircPadlock = useIRCLayout && !vs.isBubbleMessage ? padlock : null;

    // ── Pinned badge ────────────────────────────────────────────────────────────
    let pinnedMessageBadge: React.JSX.Element | null = null;
    if (vs.needsPinnedMessageBadge) {
        pinnedMessageBadge = <PinnedMessageBadge aria-describedby={vs.tileId} tabIndex={0} />;
    }

    // ── Reactions ───────────────────────────────────────────────────────────────
    let reactionsRow: React.JSX.Element | null = null;
    if (!vs.isRedacted) {
        reactionsRow = (
            <ReactionsRowWrapper
                mxEvent={vs.mxEvent}
                reactions={vs.reactions}
                key="mx_EventTile_reactionsRow"
            />
        );
    }

    // ── Footer ──────────────────────────────────────────────────────────────────
    const hasFooter = vs.needsFooter;

    // ── Reply chain ─────────────────────────────────────────────────────────────
    let replyChain: React.JSX.Element | null = null;
    if (vs.shouldRenderReplyChain && vs.replyChainProps) {
        replyChain = (
            <ReplyChain
                parentEv={vs.mxEvent}
                ref={replyChainRef}
                forExport={vs.replyChainProps.forExport}
                permalinkCreator={vs.permalinkCreator}
                layout={vs.replyChainProps.layout}
                alwaysShowTimestamps={vs.replyChainProps.alwaysShowTimestamps || vs.hover}
                isQuoteExpanded={vs.isQuoteExpanded}
                setQuoteExpanded={vm.toggleThreadExpanded}
                getRelationsForEvent={vs.getRelationsForEvent}
            />
        );
    }

    // ── Context menu ────────────────────────────────────────────────────────────
    let contextMenu: React.JSX.Element | null = null;
    if (vs.contextMenu) {
        const tile = vm.getTile();
        const chain = replyChainRef.current;
        const eventTileOps = tile?.getEventTileOps ? tile.getEventTileOps() : undefined;
        const collapseReplyChain = chain?.canCollapse() ? chain.collapse : undefined;

        contextMenu = (
            <MessageContextMenu
                {...aboveRightOf(vs.contextMenu.position)}
                mxEvent={vs.mxEvent}
                permalinkCreator={vs.permalinkCreator}
                eventTileOps={eventTileOps}
                collapseReplyChain={collapseReplyChain}
                onFinished={vm.onCloseMenu}
                rightClick={true}
                reactions={vs.reactions}
                link={vs.contextMenu.link}
                getRelationsForEvent={vs.getRelationsForEvent}
            />
        );
    }

    // ── Read receipts / sent receipt ────────────────────────────────────────────
    let msgOption: React.JSX.Element | null = null;
    if (vs.shouldShowSentReceipt || vs.shouldShowSendingReceipt) {
        msgOption = <SentReceipt messageState={vs.messageState ?? undefined} />;
    } else if (vs.showReadReceipts) {
        msgOption = (
            <ReadReceiptGroup
                readReceipts={vs.readReceipts ?? []}
                readReceiptMap={vs.readReceiptMap ?? {}}
                checkUnmounting={vs.checkUnmounting}
                suppressAnimation={vs.suppressReadReceiptAnimation}
                isTwelveHour={timestampVm.showTwelveHour}
            />
        );
    }

    // ── Thread panel summary (ThreadsList path only) ────────────────────────────
    let threadPanelSummary: React.JSX.Element | null = null;
    if (vs.thread) {
        threadPanelSummary = (
            <div className="mx_ThreadPanel_replies">
                <ThreadsIcon />
                <span className="mx_ThreadPanel_replies_amount">{vs.thread.length}</span>
                <ThreadMessagePreview thread={vs.thread} />
            </div>
        );
    }

    // ── Thread info (ThreadSummary or search link, shown in default/IRC paths) ──
    let threadInfo: React.ReactNode = null;
    if (vs.showThreadInfo) {
        if (vs.thread && vs.thread.id === vs.mxEvent.getId()) {
            threadInfo = <ThreadSummary mxEvent={vs.mxEvent} thread={vs.thread} data-testid="thread-summary" />;
        } else if (vs.timelineRenderingType === TimelineRenderingType.Search && vs.mxEvent.threadRootId) {
            if (vs.tileProps.highlightLink) {
                threadInfo = (
                    <a className="mx_ThreadSummary_icon" href={vs.tileProps.highlightLink}>
                        <ThreadsIcon />
                        {_t("timeline|thread_info_basic")}
                    </a>
                );
            } else {
                threadInfo = (
                    <p className="mx_ThreadSummary_icon">
                        <ThreadsIcon />
                        {_t("timeline|thread_info_basic")}
                    </p>
                );
            }
        }
    }

    // ── Render: switch on rendering type ────────────────────────────────────────
    switch (vs.timelineRenderingType) {
        case TimelineRenderingType.Thread:
            return React.createElement(
                vs.as || "li",
                {
                    "className": vs.outerClasses,
                    "aria-live": vs.ariaLive,
                    "aria-atomic": "true",
                    "data-scroll-tokens": vs.scrollToken,
                    "data-has-reply": !!replyChain,
                    "data-layout": vs.layout,
                    "data-self": vs.isOwnEvent,
                    "data-event-id": vs.mxEvent.getId(),
                    "onMouseEnter": vm.onHoverStart,
                    "onMouseLeave": vm.onHoverEnd,
                    "onFocus": vm.onFocusStart,
                    "onBlur": vm.onFocusEnd,
                },
                <>
                    <div className="mx_EventTile_senderDetails">
                        {avatar}
                        {sender}
                    </div>
                    <div
                        id={vs.tileId}
                        className={vs.lineClasses}
                        key="mx_EventTile_line"
                        onContextMenu={vm.onContextMenu}
                    >
                        {contextMenu}
                        {replyChain}
                        {tileContent}
                        {actionBar}
                        {linkedTimestamp}
                        {msgOption}
                    </div>
                    {hasFooter && (
                        <div className="mx_EventTile_footer" key="mx_EventTile_footer">
                            {(vs.layout === Layout.Group || !vs.isOwnEvent) && pinnedMessageBadge}
                            {reactionsRow}
                            {vs.layout === Layout.Bubble && vs.isOwnEvent && pinnedMessageBadge}
                        </div>
                    )}
                </>,
            );

        case TimelineRenderingType.Notification:
        case TimelineRenderingType.ThreadsList:
            return React.createElement(
                vs.as || "li",
                {
                    "className": vs.outerClasses,
                    "tabIndex": -1,
                    "aria-live": vs.ariaLive,
                    "aria-atomic": "true",
                    "data-scroll-tokens": vs.scrollToken,
                    "data-layout": vs.layout,
                    "data-shape": vs.timelineRenderingType,
                    "data-self": vs.isOwnEvent,
                    "data-has-reply": !!replyChain,
                    "onMouseEnter": vm.onHoverStart,
                    "onMouseLeave": vm.onHoverEnd,
                    "onFocus": vm.onFocusStart,
                    "onBlur": vm.onFocusEnd,
                    "onClick": vm.onNotificationClick,
                },
                <>
                    <div className="mx_EventTile_details">
                        {sender}
                        {vs.isRenderingNotification && vs.room ? (
                            <span className="mx_EventTile_truncated">
                                {" "}
                                {_t(
                                    "timeline|in_room_name",
                                    { room: vs.room.name },
                                    { strong: (sub) => <strong>{sub}</strong> },
                                )}
                            </span>
                        ) : (
                            ""
                        )}
                        {messageTimestamp}
                        <UnreadNotificationBadge
                            room={vs.room ?? undefined}
                            threadId={vs.mxEvent.getId()}
                            forceDot={true}
                        />
                    </div>
                    {vs.isRenderingNotification && vs.room ? (
                        <div className="mx_EventTile_avatar">
                            <RoomAvatar room={vs.room} size="28px" />
                        </div>
                    ) : (
                        avatar
                    )}
                    <div className={vs.lineClasses} key="mx_EventTile_line">
                        <div className="mx_EventTile_body">
                            {vs.mxEvent.isRedacted() ? (
                                <RedactedBody mxEvent={vs.mxEvent} />
                            ) : vs.mxEvent.isDecryptionFailure() ? (
                                <DecryptionFailureBodyWrapper mxEvent={vs.mxEvent} />
                            ) : (
                                <EventPreview mxEvent={vs.mxEvent} />
                            )}
                        </div>
                        {vs.timelineRenderingType === TimelineRenderingType.ThreadsList && threadPanelSummary}
                    </div>
                    {vs.timelineRenderingType === TimelineRenderingType.ThreadsList && (
                        <EventTileThreadToolbar
                            viewInRoom={vm.viewInRoom}
                            copyLinkToThread={vm.copyLinkToThread}
                        />
                    )}
                    {msgOption}
                </>,
            );

        case TimelineRenderingType.File:
            return React.createElement(
                vs.as || "li",
                {
                    "className": vs.outerClasses,
                    "aria-live": vs.ariaLive,
                    "aria-atomic": "true",
                    "data-scroll-tokens": vs.scrollToken,
                },
                <>
                    <a
                        className="mx_EventTile_senderDetailsLink"
                        href={linkedTimestampVm.permalink}
                        onClick={vm.onPermalinkClicked}
                    >
                        <div className="mx_EventTile_senderDetails" onContextMenu={vm.onTimestampContextMenu}>
                            {avatar}
                            {sender}
                            {linkedTimestamp}
                        </div>
                    </a>
                    <div className={vs.lineClasses} key="mx_EventTile_line" onContextMenu={vm.onContextMenu}>
                        {contextMenu}
                        {tileContent}
                    </div>
                </>,
            );

        default: {
            // Room, Search, Pinned
            return React.createElement(
                vs.as || "li",
                {
                    "className": vs.outerClasses,
                    "tabIndex": -1,
                    "aria-live": vs.ariaLive,
                    "aria-atomic": "true",
                    "data-scroll-tokens": vs.scrollToken,
                    "data-layout": vs.layout,
                    "data-self": vs.isOwnEvent,
                    "data-event-id": vs.mxEvent.getId(),
                    "data-has-reply": !!replyChain,
                    "onMouseEnter": vm.onHoverStart,
                    "onMouseLeave": vm.onHoverEnd,
                    "onFocus": vm.onFocusStart,
                    "onBlur": vm.onFocusEnd,
                },
                <>
                    {ircTimestamp}
                    {sender}
                    {ircPadlock}
                    {avatar}
                    <div
                        id={vs.tileId}
                        className={vs.lineClasses}
                        key="mx_EventTile_line"
                        onContextMenu={vm.onContextMenu}
                    >
                        {contextMenu}
                        {groupTimestamp}
                        {groupPadlock}
                        {replyChain}
                        {tileContent}
                        {actionBar}
                        {useIRCLayout && (
                            <>
                                {hasFooter && (
                                    <div className="mx_EventTile_footer">
                                        {pinnedMessageBadge}
                                        {reactionsRow}
                                    </div>
                                )}
                                {threadInfo}
                            </>
                        )}
                    </div>
                    {!useIRCLayout && (
                        <>
                            {hasFooter && (
                                <div className="mx_EventTile_footer">
                                    {(vs.layout === Layout.Group || !vs.isOwnEvent) && pinnedMessageBadge}
                                    {reactionsRow}
                                    {vs.layout === Layout.Bubble && vs.isOwnEvent && pinnedMessageBadge}
                                </div>
                            )}
                            {threadInfo}
                        </>
                    )}
                    {msgOption}
                </>,
            );
        }
    }
};
