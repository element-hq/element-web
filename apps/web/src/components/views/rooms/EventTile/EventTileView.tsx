/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    type ElementType,
    type FocusEventHandler,
    type JSX,
    type MouseEventHandler,
    type ReactNode,
    type Ref,
} from "react";

import type { MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { _t } from "../../../../languageHandler";
import { Layout } from "../../../../settings/enums/Layout";
import RoomAvatar from "../../avatars/RoomAvatar";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { UnreadNotificationBadge } from "../NotificationBadge/UnreadNotificationBadge";
import { EventTileAvatar } from "./EventTileAvatar";
import { EventTileE2ePadlock } from "./EventTileE2ePadlock";
import { EventTileMsgOption } from "./EventTileMsgOption";
import { EventTileSenderProfile } from "./EventTileSenderProfile";
import { EventTileThreadToolbar } from "./EventTileThreadToolbar";
import { EventTileTimestamp } from "./EventTileTimestamp";
import { EventTileThreadInfo } from "./EventTileThreadInfo";
import { EventTileThreadPanelSummary } from "./EventTileThreadPanelSummary";

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

export interface EventTileViewProps {
    as?: string;
    rootRef?: Ref<HTMLElement>;
    id: string;
    mxEvent: MatrixEvent;
    room?: Room | null;
    layout?: Layout;
    timelineRenderingType: TimelineRenderingType;
    classes: string;
    lineClasses: string;
    ariaLive?: "off";
    scrollToken?: string;
    isTwelveHour?: boolean;
    isOwnEvent: boolean;
    isRenderingNotification: boolean;
    replyChain?: ReactNode;
    avatarMember?: RoomMember | null;
    avatarSize?: string | null;
    avatarViewUserOnClick: boolean;
    avatarForceHistorical: boolean;
    senderMode: "hidden" | "default" | "composerInsert" | "tooltip";
    onSenderProfileClick?: () => void;
    actionBar?: ReactNode;
    messageBody: ReactNode;
    threadInfoSummary?: ReactNode;
    threadInfoHref?: string;
    threadInfoLabel?: string;
    threadPanelReplyCount?: number;
    threadPanelPreview?: ReactNode;
    showThreadToolbar?: boolean;
    sentReceiptIcon?: ReactNode;
    sentReceiptLabel?: string;
    readReceipts?: ReactNode;
    pinnedMessageBadge?: ReactNode;
    reactionsRow?: ReactNode;
    hasFooter: boolean;
    showTimestamp?: boolean;
    showLinkedTimestamp?: boolean;
    showDummyTimestamp?: boolean;
    timestampTs?: number;
    timestampReceivedTs?: number;
    showRelativeTimestamp?: boolean;
    showGroupPadlock: boolean;
    showIrcPadlock: boolean;
    e2ePadlockIcon: "none" | "normal" | "warning" | "decryptionFailure";
    e2ePadlockTitle?: string;
    e2ePadlockSharedUserId?: string;
    e2ePadlockRoomId?: string;
    contextMenu?: ReactNode;
    onMouseEnter: MouseEventHandler<HTMLElement>;
    onMouseLeave: MouseEventHandler<HTMLElement>;
    onFocus: FocusEventHandler<HTMLElement>;
    onBlur: FocusEventHandler<HTMLElement>;
    onClick?: MouseEventHandler<HTMLElement>;
    onContextMenu: MouseEventHandler<HTMLElement>;
    onTimestampContextMenu?: MouseEventHandler<HTMLElement>;
    onPermalinkClicked?: MouseEventHandler<HTMLElement>;
    viewInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => void;
    permalink: string;
}

export function EventTileView(props: EventTileViewProps): JSX.Element {
    const {
        as,
        rootRef,
        id,
        mxEvent,
        room,
        layout,
        timelineRenderingType,
        classes,
        lineClasses,
        ariaLive,
        scrollToken,
        isTwelveHour,
        isOwnEvent,
        isRenderingNotification,
        replyChain,
        avatarMember,
        avatarSize,
        avatarViewUserOnClick,
        avatarForceHistorical,
        senderMode,
        onSenderProfileClick,
        actionBar,
        messageBody,
        threadInfoSummary,
        threadInfoHref,
        threadInfoLabel,
        threadPanelReplyCount,
        threadPanelPreview,
        showThreadToolbar,
        sentReceiptIcon,
        sentReceiptLabel,
        readReceipts,
        pinnedMessageBadge,
        reactionsRow,
        hasFooter,
        showTimestamp,
        showLinkedTimestamp,
        showDummyTimestamp,
        timestampTs,
        timestampReceivedTs,
        showRelativeTimestamp,
        showGroupPadlock,
        showIrcPadlock,
        e2ePadlockIcon,
        e2ePadlockTitle,
        e2ePadlockSharedUserId,
        e2ePadlockRoomId,
        contextMenu,
        onMouseEnter,
        onMouseLeave,
        onFocus,
        onBlur,
        onClick,
        onContextMenu,
        onTimestampContextMenu,
        onPermalinkClicked,
        viewInRoom,
        copyLinkToThread,
        permalink,
    } = props;

    const Root = (as ?? "li") as ElementType;
    const avatar = (
        <EventTileAvatar
            member={avatarMember}
            size={avatarSize}
            viewUserOnClick={avatarViewUserOnClick}
            forceHistorical={avatarForceHistorical}
        />
    );
    const sender = <EventTileSenderProfile mode={senderMode} mxEvent={mxEvent} onClick={onSenderProfileClick} />;
    const timestamp = showTimestamp ? (
        <EventTileTimestamp
            showRelative={showRelativeTimestamp}
            showTwelveHour={isTwelveHour}
            ts={timestampTs ?? 0}
            receivedTs={timestampReceivedTs}
        />
    ) : undefined;
    const linkedTimestamp = !showLinkedTimestamp ? undefined : !showTimestamp ? (
        showDummyTimestamp ? (
            <span className="mx_MessageTimestamp" />
        ) : undefined
    ) : (
        <EventTileTimestamp
            showRelative={showRelativeTimestamp}
            showTwelveHour={isTwelveHour}
            ts={timestampTs ?? 0}
            receivedTs={timestampReceivedTs}
            href={permalink}
            onClick={onPermalinkClicked}
            onContextMenu={onTimestampContextMenu}
        />
    );
    const groupTimestamp = layout !== Layout.IRC ? linkedTimestamp : null;
    const ircTimestamp = layout === Layout.IRC ? linkedTimestamp : null;
    const groupPadlock = showGroupPadlock ? (
        <EventTileE2ePadlock
            icon={e2ePadlockIcon}
            title={e2ePadlockTitle}
            sharedUserId={e2ePadlockSharedUserId}
            roomId={e2ePadlockRoomId}
        />
    ) : null;
    const ircPadlock = showIrcPadlock ? (
        <EventTileE2ePadlock
            icon={e2ePadlockIcon}
            title={e2ePadlockTitle}
            sharedUserId={e2ePadlockSharedUserId}
            roomId={e2ePadlockRoomId}
        />
    ) : null;

    switch (timelineRenderingType) {
        case TimelineRenderingType.Thread:
            return (
                <Root
                    ref={rootRef}
                    className={classes}
                    aria-live={ariaLive}
                    aria-atomic={true}
                    data-scroll-tokens={scrollToken}
                    data-has-reply={!!replyChain}
                    data-layout={layout}
                    data-self={isOwnEvent}
                    data-event-id={mxEvent.getId()}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onFocus={onFocus}
                    onBlur={onBlur}
                >
                    <div className="mx_EventTile_senderDetails">
                        {avatar}
                        {sender}
                    </div>
                    <div id={id} className={lineClasses} onContextMenu={onContextMenu}>
                        {contextMenu}
                        {replyChain}
                        {messageBody}
                        {actionBar}
                        {linkedTimestamp}
                        <EventTileMsgOption
                            sentReceiptIcon={sentReceiptIcon}
                            sentReceiptLabel={sentReceiptLabel}
                            readReceipts={readReceipts}
                        />
                    </div>
                    {hasFooter && (
                        <div className="mx_EventTile_footer">
                            {(layout === Layout.Group || !isOwnEvent) && pinnedMessageBadge}
                            {reactionsRow}
                            {layout === Layout.Bubble && isOwnEvent && pinnedMessageBadge}
                        </div>
                    )}
                </Root>
            );
        case TimelineRenderingType.Notification:
        case TimelineRenderingType.ThreadsList:
            return (
                <Root
                    ref={rootRef}
                    className={classes}
                    tabIndex={-1}
                    aria-live={ariaLive}
                    aria-atomic="true"
                    data-scroll-tokens={scrollToken}
                    data-layout={layout}
                    data-shape={timelineRenderingType}
                    data-self={isOwnEvent}
                    data-has-reply={!!replyChain}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onClick={onClick}
                >
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
                        <UnreadNotificationBadge room={room || undefined} threadId={mxEvent.getId()} forceDot={true} />
                    </div>
                    {isRenderingNotification && room ? (
                        <div className="mx_EventTile_avatar">
                            <RoomAvatar room={room} size="28px" />
                        </div>
                    ) : (
                        avatar
                    )}
                    <div className={lineClasses}>
                        <div className="mx_EventTile_body">{messageBody}</div>
                        {threadPanelReplyCount !== undefined && threadPanelPreview !== undefined && (
                            <EventTileThreadPanelSummary
                                replyCount={threadPanelReplyCount}
                                preview={threadPanelPreview}
                            />
                        )}
                    </div>
                    {showThreadToolbar && (
                        <EventTileThreadToolbar viewInRoom={viewInRoom} copyLinkToThread={copyLinkToThread} />
                    )}
                    <EventTileMsgOption
                        sentReceiptIcon={sentReceiptIcon}
                        sentReceiptLabel={sentReceiptLabel}
                        readReceipts={readReceipts}
                    />
                </Root>
            );
        case TimelineRenderingType.File:
            return (
                <Root className={classes} aria-live={ariaLive} aria-atomic={true} data-scroll-tokens={scrollToken}>
                    <a className="mx_EventTile_senderDetailsLink" href={permalink} onClick={onPermalinkClicked}>
                        <div className="mx_EventTile_senderDetails" onContextMenu={onTimestampContextMenu}>
                            {avatar}
                            {sender}
                            {timestamp}
                        </div>
                    </a>
                    <div className={lineClasses} onContextMenu={onContextMenu}>
                        {contextMenu}
                        {messageBody}
                    </div>
                </Root>
            );
        default:
            return (
                <Root
                    ref={rootRef}
                    className={classes}
                    tabIndex={-1}
                    aria-live={ariaLive}
                    aria-atomic="true"
                    data-scroll-tokens={scrollToken}
                    data-layout={layout}
                    data-self={isOwnEvent}
                    data-event-id={mxEvent.getId()}
                    data-has-reply={!!replyChain}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onFocus={onFocus}
                    onBlur={onBlur}
                >
                    {ircTimestamp}
                    {sender}
                    {ircPadlock}
                    {avatar}
                    <div id={id} className={lineClasses} onContextMenu={onContextMenu}>
                        {contextMenu}
                        {groupTimestamp}
                        {groupPadlock}
                        {replyChain}
                        {messageBody}
                        {actionBar}
                        {layout === Layout.IRC && (
                            <>
                                {hasFooter && (
                                    <div className="mx_EventTile_footer">
                                        {pinnedMessageBadge}
                                        {reactionsRow}
                                    </div>
                                )}
                                <EventTileThreadInfo
                                    summary={threadInfoSummary}
                                    href={threadInfoHref}
                                    label={threadInfoLabel}
                                />
                            </>
                        )}
                    </div>
                    {layout !== Layout.IRC && (
                        <>
                            {hasFooter && (
                                <div className="mx_EventTile_footer">
                                    {(layout === Layout.Group || !isOwnEvent) && pinnedMessageBadge}
                                    {reactionsRow}
                                    {layout === Layout.Bubble && isOwnEvent && pinnedMessageBadge}
                                </div>
                            )}
                            <EventTileThreadInfo
                                summary={threadInfoSummary}
                                href={threadInfoHref}
                                label={threadInfoLabel}
                            />
                        </>
                    )}
                    <EventTileMsgOption
                        sentReceiptIcon={sentReceiptIcon}
                        sentReceiptLabel={sentReceiptLabel}
                        readReceipts={readReceipts}
                    />
                </Root>
            );
    }
}
