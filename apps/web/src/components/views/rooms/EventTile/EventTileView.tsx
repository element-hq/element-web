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

import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { Layout } from "../../../../settings/enums/Layout";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { EncryptionIndicator } from "./EncryptionIndicator";
import { ThreadToolbar } from "./ThreadToolbar";
import { Timestamp } from "./Timestamp";
import { ThreadPanelSummary } from "./ThreadPanelSummary";
import { type EncryptionIndicatorMode } from "./EventTileModes";

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
    eventId?: string;
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
    avatar?: ReactNode;
    sender?: ReactNode;
    actionBar?: ReactNode;
    messageBody: ReactNode;
    threadInfo?: ReactNode;
    threadPanelReplyCount?: number;
    threadPanelPreview?: ReactNode;
    showThreadToolbar?: boolean;
    messageStatus?: ReactNode;
    footer?: ReactNode;
    showTimestamp?: boolean;
    showLinkedTimestamp?: boolean;
    showDummyTimestamp?: boolean;
    timestampTs?: number;
    timestampReceivedTs?: number;
    showRelativeTimestamp?: boolean;
    showGroupPadlock: boolean;
    showIrcPadlock: boolean;
    encryptionIndicatorMode: EncryptionIndicatorMode;
    encryptionIndicatorTitle?: string;
    sharedKeysUserId?: string;
    sharedKeysRoomId?: string;
    notificationRoomLabel?: ReactNode;
    notificationRoomAvatar?: ReactNode;
    unreadBadge?: ReactNode;
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
        eventId,
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
        avatar,
        sender,
        actionBar,
        messageBody,
        threadInfo,
        threadPanelReplyCount,
        threadPanelPreview,
        showThreadToolbar,
        messageStatus,
        footer,
        showTimestamp,
        showLinkedTimestamp,
        showDummyTimestamp,
        timestampTs,
        timestampReceivedTs,
        showRelativeTimestamp,
        showGroupPadlock,
        showIrcPadlock,
        encryptionIndicatorMode,
        encryptionIndicatorTitle,
        sharedKeysUserId,
        sharedKeysRoomId,
        notificationRoomLabel,
        notificationRoomAvatar,
        unreadBadge,
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
    const timestamp = showTimestamp ? (
        <Timestamp
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
        <Timestamp
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
        <EncryptionIndicator
            icon={encryptionIndicatorMode}
            title={encryptionIndicatorTitle}
            sharedUserId={sharedKeysUserId}
            roomId={sharedKeysRoomId}
        />
    ) : null;
    const ircPadlock = showIrcPadlock ? (
        <EncryptionIndicator
            icon={encryptionIndicatorMode}
            title={encryptionIndicatorTitle}
            sharedUserId={sharedKeysUserId}
            roomId={sharedKeysRoomId}
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
                    data-event-id={eventId}
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
                        {messageStatus}
                    </div>
                    {footer && <div className="mx_EventTile_footer">{footer}</div>}
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
                        {isRenderingNotification && notificationRoomLabel ? (
                            <span className="mx_EventTile_truncated">{notificationRoomLabel}</span>
                        ) : (
                            ""
                        )}
                        {timestamp}
                        {unreadBadge}
                    </div>
                    {isRenderingNotification && notificationRoomAvatar ? (
                        notificationRoomAvatar
                    ) : (
                        avatar
                    )}
                    <div className={lineClasses}>
                        <div className="mx_EventTile_body">{messageBody}</div>
                        {threadPanelReplyCount !== undefined && threadPanelPreview !== undefined && (
                            <ThreadPanelSummary replyCount={threadPanelReplyCount} preview={threadPanelPreview} />
                        )}
                    </div>
                    {showThreadToolbar && <ThreadToolbar viewInRoom={viewInRoom} copyLinkToThread={copyLinkToThread} />}
                    {messageStatus}
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
                    data-event-id={eventId}
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
                                {footer && <div className="mx_EventTile_footer">{footer}</div>}
                                {threadInfo}
                            </>
                        )}
                    </div>
                    {layout !== Layout.IRC && (
                        <>
                            {footer && <div className="mx_EventTile_footer">{footer}</div>}
                            {threadInfo}
                        </>
                    )}
                    {messageStatus}
                </Root>
            );
    }
}
