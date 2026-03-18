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
    contentId: string;
    eventId?: string;
    layout?: Layout;
    timelineRenderingType: TimelineRenderingType;
    rootClassName: string;
    contentClassName: string;
    ariaLive?: "off";
    scrollTokens?: string;
    isOwnEvent: boolean;
    content: {
        sender?: ReactNode;
        avatar?: ReactNode;
        replyChain?: ReactNode;
        messageBody: ReactNode;
        actionBar?: ReactNode;
        messageStatus?: ReactNode;
        footer?: ReactNode;
        contextMenu?: ReactNode;
    };
    threads: {
        info?: ReactNode;
        replyCount?: number;
        preview?: ReactNode;
        showToolbar?: boolean;
        openInRoom: (evt: ButtonEvent) => void;
        copyLinkToThread: (evt: ButtonEvent) => void;
    };
    timestamp: {
        show?: boolean;
        showLinked?: boolean;
        showPlaceholder?: boolean;
        ts?: number;
        receivedTs?: number;
        showRelative?: boolean;
        isTwelveHour?: boolean;
        permalink: string;
        onPermalinkClicked?: MouseEventHandler<HTMLElement>;
        onContextMenu?: MouseEventHandler<HTMLElement>;
    };
    encryption: {
        showGroupPadlock: boolean;
        showIrcPadlock: boolean;
        mode: EncryptionIndicatorMode;
        indicatorTitle?: string;
        sharedKeysUserId?: string;
        sharedKeysRoomId?: string;
    };
    notification: {
        enabled: boolean;
        roomLabel?: ReactNode;
        roomAvatar?: ReactNode;
        unreadBadge?: ReactNode;
    };
    handlers: {
        onClick?: MouseEventHandler<HTMLElement>;
        onContextMenu: MouseEventHandler<HTMLElement>;
        onMouseEnter: MouseEventHandler<HTMLElement>;
        onMouseLeave: MouseEventHandler<HTMLElement>;
        onFocus: FocusEventHandler<HTMLElement>;
        onBlur: FocusEventHandler<HTMLElement>;
    };
}

export function EventTileView(props: EventTileViewProps): JSX.Element {
    const {
        as,
        rootRef,
        contentId,
        eventId,
        layout,
        timelineRenderingType,
        rootClassName,
        contentClassName,
        ariaLive,
        scrollTokens,
        isOwnEvent,
        content,
        threads,
        timestamp,
        encryption,
        notification,
        handlers,
    } = props;

    const Root = (as ?? "li") as ElementType;
    const timestampNode = timestamp.show ? (
        <Timestamp
            showRelative={timestamp.showRelative}
            showTwelveHour={timestamp.isTwelveHour}
            ts={timestamp.ts ?? 0}
            receivedTs={timestamp.receivedTs}
        />
    ) : undefined;
    const linkedTimestamp = !timestamp.showLinked ? undefined : !timestamp.show ? (
        timestamp.showPlaceholder ? (
            <span className="mx_MessageTimestamp" />
        ) : undefined
    ) : (
        <Timestamp
            showRelative={timestamp.showRelative}
            showTwelveHour={timestamp.isTwelveHour}
            ts={timestamp.ts ?? 0}
            receivedTs={timestamp.receivedTs}
            href={timestamp.permalink}
            onClick={timestamp.onPermalinkClicked}
            onContextMenu={timestamp.onContextMenu}
        />
    );
    const groupTimestamp = layout !== Layout.IRC ? linkedTimestamp : null;
    const ircTimestamp = layout === Layout.IRC ? linkedTimestamp : null;
    const groupPadlock = encryption.showGroupPadlock ? (
        <EncryptionIndicator
            icon={encryption.mode}
            title={encryption.indicatorTitle}
            sharedUserId={encryption.sharedKeysUserId}
            roomId={encryption.sharedKeysRoomId}
        />
    ) : null;
    const ircPadlock = encryption.showIrcPadlock ? (
        <EncryptionIndicator
            icon={encryption.mode}
            title={encryption.indicatorTitle}
            sharedUserId={encryption.sharedKeysUserId}
            roomId={encryption.sharedKeysRoomId}
        />
    ) : null;

    switch (timelineRenderingType) {
        case TimelineRenderingType.Thread:
            return (
                <Root
                    ref={rootRef}
                    className={rootClassName}
                    aria-live={ariaLive}
                    aria-atomic={true}
                    data-scroll-tokens={scrollTokens}
                    data-has-reply={!!content.replyChain}
                    data-layout={layout}
                    data-self={isOwnEvent}
                    data-event-id={eventId}
                    onMouseEnter={handlers.onMouseEnter}
                    onMouseLeave={handlers.onMouseLeave}
                    onFocus={handlers.onFocus}
                    onBlur={handlers.onBlur}
                >
                    <div className="mx_EventTile_senderDetails">
                        {content.avatar}
                        {content.sender}
                    </div>
                    <div id={contentId} className={contentClassName} onContextMenu={handlers.onContextMenu}>
                        {content.contextMenu}
                        {content.replyChain}
                        {content.messageBody}
                        {content.actionBar}
                        {linkedTimestamp}
                        {content.messageStatus}
                    </div>
                    {content.footer && <div className="mx_EventTile_footer">{content.footer}</div>}
                </Root>
            );
        case TimelineRenderingType.Notification:
        case TimelineRenderingType.ThreadsList:
            return (
                <Root
                    ref={rootRef}
                    className={rootClassName}
                    tabIndex={-1}
                    aria-live={ariaLive}
                    aria-atomic="true"
                    data-scroll-tokens={scrollTokens}
                    data-layout={layout}
                    data-shape={timelineRenderingType}
                    data-self={isOwnEvent}
                    data-has-reply={!!content.replyChain}
                    onMouseEnter={handlers.onMouseEnter}
                    onMouseLeave={handlers.onMouseLeave}
                    onFocus={handlers.onFocus}
                    onBlur={handlers.onBlur}
                    onClick={handlers.onClick}
                >
                    <div className="mx_EventTile_details">
                        {content.sender}
                        {notification.enabled && notification.roomLabel ? (
                            <span className="mx_EventTile_truncated">{notification.roomLabel}</span>
                        ) : (
                            ""
                        )}
                        {timestampNode}
                        {notification.unreadBadge}
                    </div>
                    {notification.enabled && notification.roomAvatar ? (
                        notification.roomAvatar
                    ) : (
                        content.avatar
                    )}
                    <div className={contentClassName}>
                        <div className="mx_EventTile_body">{content.messageBody}</div>
                        {threads.replyCount !== undefined && threads.preview !== undefined && (
                            <ThreadPanelSummary
                                replyCount={threads.replyCount}
                                preview={threads.preview}
                            />
                        )}
                    </div>
                    {threads.showToolbar && (
                        <ThreadToolbar
                            viewInRoom={threads.openInRoom}
                            copyLinkToThread={threads.copyLinkToThread}
                        />
                    )}
                    {content.messageStatus}
                </Root>
            );
        case TimelineRenderingType.File:
            return (
                <Root className={rootClassName} aria-live={ariaLive} aria-atomic={true} data-scroll-tokens={scrollTokens}>
                    <a
                        className="mx_EventTile_senderDetailsLink"
                        href={timestamp.permalink}
                        onClick={timestamp.onPermalinkClicked}
                    >
                        <div className="mx_EventTile_senderDetails" onContextMenu={timestamp.onContextMenu}>
                            {content.avatar}
                            {content.sender}
                            {timestampNode}
                        </div>
                    </a>
                    <div className={contentClassName} onContextMenu={handlers.onContextMenu}>
                        {content.contextMenu}
                        {content.messageBody}
                    </div>
                </Root>
            );
        default:
            return (
                <Root
                    ref={rootRef}
                    className={rootClassName}
                    tabIndex={-1}
                    aria-live={ariaLive}
                    aria-atomic="true"
                    data-scroll-tokens={scrollTokens}
                    data-layout={layout}
                    data-self={isOwnEvent}
                    data-event-id={eventId}
                    data-has-reply={!!content.replyChain}
                    onMouseEnter={handlers.onMouseEnter}
                    onMouseLeave={handlers.onMouseLeave}
                    onFocus={handlers.onFocus}
                    onBlur={handlers.onBlur}
                >
                    {ircTimestamp}
                    {content.sender}
                    {ircPadlock}
                    {content.avatar}
                    <div id={contentId} className={contentClassName} onContextMenu={handlers.onContextMenu}>
                        {content.contextMenu}
                        {groupTimestamp}
                        {groupPadlock}
                        {content.replyChain}
                        {content.messageBody}
                        {content.actionBar}
                        {layout === Layout.IRC && (
                            <>
                                {content.footer && <div className="mx_EventTile_footer">{content.footer}</div>}
                                {threads.info}
                            </>
                        )}
                    </div>
                    {layout !== Layout.IRC && (
                        <>
                            {content.footer && <div className="mx_EventTile_footer">{content.footer}</div>}
                            {threads.info}
                        </>
                    )}
                    {content.messageStatus}
                </Root>
            );
    }
}
