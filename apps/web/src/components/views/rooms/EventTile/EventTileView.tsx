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

import type { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { _t } from "../../../../languageHandler";
import { Layout } from "../../../../settings/enums/Layout";
import RoomAvatar from "../../avatars/RoomAvatar";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { UnreadNotificationBadge } from "../NotificationBadge/UnreadNotificationBadge";
import { EventTileThreadToolbar } from "./EventTileThreadToolbar";

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
    isOwnEvent: boolean;
    isRenderingNotification: boolean;
    replyChain?: ReactNode;
    avatar?: ReactNode;
    sender?: ReactNode;
    actionBar?: ReactNode;
    messageBody: ReactNode;
    threadInfo?: ReactNode;
    threadPanelSummary?: ReactNode;
    msgOption?: ReactNode;
    pinnedMessageBadge?: ReactNode;
    reactionsRow?: ReactNode;
    hasFooter: boolean;
    timestamp?: ReactNode;
    linkedTimestamp?: ReactNode;
    groupTimestamp?: ReactNode;
    ircTimestamp?: ReactNode;
    groupPadlock?: ReactNode;
    ircPadlock?: ReactNode;
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
        isOwnEvent,
        isRenderingNotification,
        replyChain,
        avatar,
        sender,
        actionBar,
        messageBody,
        threadInfo,
        threadPanelSummary,
        msgOption,
        pinnedMessageBadge,
        reactionsRow,
        hasFooter,
        timestamp,
        linkedTimestamp,
        groupTimestamp,
        ircTimestamp,
        groupPadlock,
        ircPadlock,
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
                        {msgOption}
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
                        {threadPanelSummary}
                    </div>
                    {timelineRenderingType === TimelineRenderingType.ThreadsList && (
                        <EventTileThreadToolbar viewInRoom={viewInRoom} copyLinkToThread={copyLinkToThread} />
                    )}
                    {msgOption}
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
                                {threadInfo}
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
                            {threadInfo}
                        </>
                    )}
                    {msgOption}
                </Root>
            );
    }
}
