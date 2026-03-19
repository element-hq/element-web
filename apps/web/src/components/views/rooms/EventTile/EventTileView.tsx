/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, {
    memo,
    type ElementType,
    type FocusEventHandler,
    type JSX,
    type MouseEventHandler,
    type ReactNode,
    type Ref,
} from "react";

import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import {
    PadlockMode,
    type EncryptionIndicatorMode,
    TimestampDisplayMode,
    TimestampFormatMode,
} from "../../../../models/rooms/EventTileModel";
import { Layout } from "../../../../settings/enums/Layout";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { EncryptionIndicator } from "./EncryptionIndicator";
import { ThreadToolbar } from "./ThreadToolbar";
import { Timestamp } from "./Timestamp";
import { ThreadPanelSummary } from "./ThreadPanelSummary";

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

type EventTileContentProps = {
    sender?: ReactNode;
    avatar?: ReactNode;
    replyChain?: ReactNode;
    messageBody: ReactNode;
    actionBar?: ReactNode;
    messageStatus?: ReactNode;
    footer?: ReactNode;
    contextMenu?: ReactNode;
};

type EventTileThreadsProps = {
    info?: ReactNode;
    replyCount?: number;
    preview?: ReactNode;
    showToolbar?: boolean;
    openInRoom: (evt: ButtonEvent) => void;
    copyLinkToThread: (evt: ButtonEvent) => void;
};

type EventTileTimestampProps = {
    displayMode: TimestampDisplayMode;
    formatMode: TimestampFormatMode;
    isTwelveHour?: boolean;
    ts?: number;
    receivedTs?: number;
    permalink: string;
    onPermalinkClicked?: MouseEventHandler<HTMLElement>;
    onContextMenu?: MouseEventHandler<HTMLElement>;
};

type EventTileEncryptionProps = {
    padlockMode: PadlockMode;
    mode: EncryptionIndicatorMode;
    indicatorTitle?: string;
    sharedKeysUserId?: string;
    sharedKeysRoomId?: string;
};

type EventTileNotificationProps = {
    enabled: boolean;
    roomLabel?: ReactNode;
    roomAvatar?: ReactNode;
    unreadBadge?: ReactNode;
};

type EventTileHandlersProps = {
    onClick?: MouseEventHandler<HTMLElement>;
    onMouseEnter: MouseEventHandler<HTMLElement>;
    onMouseLeave: MouseEventHandler<HTMLElement>;
    onFocus: FocusEventHandler<HTMLElement>;
    onBlur: FocusEventHandler<HTMLElement>;
    onContextMenu: MouseEventHandler<HTMLElement>;
};

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
    content: EventTileContentProps;
    threads: EventTileThreadsProps;
    timestamp: EventTileTimestampProps;
    encryption: EventTileEncryptionProps;
    notification: EventTileNotificationProps;
    handlers: EventTileHandlersProps;
}

type PlainTimestampProps = {
    timestamp: EventTileTimestampProps;
};

const PlainTimestamp = memo(function PlainTimestamp({ timestamp }: PlainTimestampProps): JSX.Element | null {
    if (timestamp.displayMode !== TimestampDisplayMode.Plain) return null;

    return (
        <Timestamp
            showRelative={timestamp.formatMode === TimestampFormatMode.Relative}
            showTwelveHour={timestamp.isTwelveHour}
            ts={timestamp.ts ?? 0}
            receivedTs={timestamp.receivedTs}
        />
    );
});

const LinkedTimestamp = memo(function LinkedTimestamp({ timestamp }: PlainTimestampProps): JSX.Element | null {
    if (timestamp.displayMode === TimestampDisplayMode.Hidden || timestamp.displayMode === TimestampDisplayMode.Plain) {
        return null;
    }
    if (timestamp.displayMode === TimestampDisplayMode.Placeholder) {
        return <span className="mx_MessageTimestamp" />;
    }

    return (
        <Timestamp
            showRelative={timestamp.formatMode === TimestampFormatMode.Relative}
            showTwelveHour={timestamp.isTwelveHour}
            ts={timestamp.ts ?? 0}
            receivedTs={timestamp.receivedTs}
            href={timestamp.permalink}
            onClick={timestamp.onPermalinkClicked}
            onContextMenu={timestamp.onContextMenu}
        />
    );
});

type EventContentRegionProps = {
    contentId?: string;
    contentClassName: string;
    onContextMenu: MouseEventHandler<HTMLElement>;
    children: ReactNode;
};

const EventContentRegion = memo(function EventContentRegion({
    contentId,
    contentClassName,
    onContextMenu,
    children,
}: EventContentRegionProps): JSX.Element {
    return (
        <div id={contentId} className={contentClassName} onContextMenu={onContextMenu}>
            {children}
        </div>
    );
});

type FooterThreadMetaProps = {
    footer?: ReactNode;
    info?: ReactNode;
};

const FooterThreadMeta = memo(function FooterThreadMeta({ footer, info }: FooterThreadMetaProps): JSX.Element | null {
    if (!footer && !info) return null;

    return (
        <>
            {footer && <div className="mx_EventTile_footer">{footer}</div>}
            {info}
        </>
    );
});

const ThreadsPanelRegion = memo(function ThreadsPanelRegion({
    replyCount,
    preview,
    showToolbar,
    openInRoom,
    copyLinkToThread,
}: EventTileViewProps["threads"]): JSX.Element | null {
    if (replyCount === undefined && preview === undefined && !showToolbar) {
        return null;
    }

    return (
        <>
            {replyCount !== undefined && preview !== undefined && (
                <ThreadPanelSummary replyCount={replyCount} preview={preview} />
            )}
            {showToolbar && <ThreadToolbar viewInRoom={openInRoom} copyLinkToThread={copyLinkToThread} />}
        </>
    );
});

function EventTileViewComponent(props: EventTileViewProps): JSX.Element {
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
                    <EventContentRegion
                        contentId={contentId}
                        contentClassName={contentClassName}
                        onContextMenu={handlers.onContextMenu}
                    >
                        {content.contextMenu}
                        {content.replyChain}
                        {content.messageBody}
                        {content.actionBar}
                        <LinkedTimestamp timestamp={timestamp} />
                        {content.messageStatus}
                    </EventContentRegion>
                    <FooterThreadMeta footer={content.footer} />
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
                        <PlainTimestamp timestamp={timestamp} />
                        {notification.unreadBadge}
                    </div>
                    {notification.enabled && notification.roomAvatar ? notification.roomAvatar : content.avatar}
                    <EventContentRegion contentClassName={contentClassName} onContextMenu={handlers.onContextMenu}>
                        <div className="mx_EventTile_body">{content.messageBody}</div>
                        <ThreadsPanelRegion {...threads} />
                    </EventContentRegion>
                    {content.messageStatus}
                </Root>
            );
        case TimelineRenderingType.File:
            return (
                <Root
                    className={rootClassName}
                    aria-live={ariaLive}
                    aria-atomic={true}
                    data-scroll-tokens={scrollTokens}
                >
                    <a
                        className="mx_EventTile_senderDetailsLink"
                        href={timestamp.permalink}
                        onClick={timestamp.onPermalinkClicked}
                    >
                        <div className="mx_EventTile_senderDetails" onContextMenu={timestamp.onContextMenu}>
                            {content.avatar}
                            {content.sender}
                            <PlainTimestamp timestamp={timestamp} />
                        </div>
                    </a>
                    <EventContentRegion contentClassName={contentClassName} onContextMenu={handlers.onContextMenu}>
                        {content.contextMenu}
                        {content.messageBody}
                    </EventContentRegion>
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
                    {layout === Layout.IRC && <LinkedTimestamp timestamp={timestamp} />}
                    {content.sender}
                    {encryption.padlockMode === PadlockMode.Irc && (
                        <EncryptionIndicator
                            icon={encryption.mode}
                            title={encryption.indicatorTitle}
                            sharedUserId={encryption.sharedKeysUserId}
                            roomId={encryption.sharedKeysRoomId}
                        />
                    )}
                    {content.avatar}
                    <EventContentRegion
                        contentId={contentId}
                        contentClassName={contentClassName}
                        onContextMenu={handlers.onContextMenu}
                    >
                        {content.contextMenu}
                        {layout !== Layout.IRC && <LinkedTimestamp timestamp={timestamp} />}
                        {encryption.padlockMode === PadlockMode.Group && (
                            <EncryptionIndicator
                                icon={encryption.mode}
                                title={encryption.indicatorTitle}
                                sharedUserId={encryption.sharedKeysUserId}
                                roomId={encryption.sharedKeysRoomId}
                            />
                        )}
                        {content.replyChain}
                        {content.messageBody}
                        {content.actionBar}
                        {layout === Layout.IRC && <FooterThreadMeta footer={content.footer} info={threads.info} />}
                    </EventContentRegion>
                    {layout !== Layout.IRC && <FooterThreadMeta footer={content.footer} info={threads.info} />}
                    {content.messageStatus}
                </Root>
            );
    }
}

export const EventTileView = memo(EventTileViewComponent);
