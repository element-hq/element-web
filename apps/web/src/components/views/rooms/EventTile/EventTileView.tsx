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
import { EncryptionIndicator } from "./EncryptionIndicator";
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

/** Structured content regions rendered inside the tile body. */
type EventTileContentProps = {
    /** Sender node, when shown. */
    sender?: ReactNode;
    /** Avatar node, when shown. */
    avatar?: ReactNode;
    /** Reply preview node, when shown. */
    replyChain?: ReactNode;
    /** Message body node for the event content. */
    messageBody: ReactNode;
    /** Action bar node for the tile controls. */
    actionBar?: ReactNode;
    /** Message status node when shown. */
    messageStatus?: ReactNode;
    /** Footer node when shown. */
    footer?: ReactNode;
    /** Context menu node when the menu is open. */
    contextMenu?: ReactNode;
};

/** Thread summary and toolbar props for the tile. */
type EventTileThreadsProps = {
    /** Inline thread metadata node. */
    info?: ReactNode;
    /** Reply count for the thread summary. */
    replyCount?: number;
    /** Thread preview node. */
    preview?: ReactNode;
    /** Thread toolbar node, when shown. */
    toolbar?: ReactNode;
};

/** Timestamp display props for the tile. */
type EventTileTimestampProps = {
    /** Timestamp display mode. */
    displayMode: TimestampDisplayMode;
    /** Timestamp formatting mode. */
    formatMode: TimestampFormatMode;
    /** Whether timestamps should use a twelve-hour clock. */
    isTwelveHour?: boolean;
    /** Event timestamp in milliseconds. */
    ts?: number;
    /** Received timestamp in milliseconds. */
    receivedTs?: number;
    /** Permalink for the event. */
    permalink: string;
    /** Click handler for timestamp permalinks. */
    onPermalinkClicked?: MouseEventHandler<HTMLElement>;
    /** Context menu handler for the timestamp. */
    onContextMenu?: MouseEventHandler<HTMLElement>;
};

/** Encryption indicator props for the tile. */
type EventTileEncryptionProps = {
    /** Padlock presentation mode. */
    padlockMode: PadlockMode;
    /** Encryption indicator icon mode. */
    mode: EncryptionIndicatorMode;
    /** Optional tooltip title for the indicator. */
    indicatorTitle?: string;
    /** User ID that shared keys for the event, when available. */
    sharedKeysUserId?: string;
    /** Room ID associated with shared keys, when available. */
    sharedKeysRoomId?: string;
};

/** Notification-specific room metadata rendered in list-style timelines. */
type EventTileNotificationProps = {
    /** Whether notification metadata should be shown. */
    enabled: boolean;
    /** Optional room label node. */
    roomLabel?: ReactNode;
    /** Optional room avatar node. */
    roomAvatar?: ReactNode;
    /** Optional unread badge node. */
    unreadBadge?: ReactNode;
};

/** DOM event handlers attached to the tile root or content regions. */
type EventTileHandlersProps = {
    /** Optional click handler for the tile root. */
    onClick?: MouseEventHandler<HTMLElement>;
    /** Mouse enter handler for the tile root. */
    onMouseEnter: MouseEventHandler<HTMLElement>;
    /** Mouse leave handler for the tile root. */
    onMouseLeave: MouseEventHandler<HTMLElement>;
    /** Focus handler for the tile root. */
    onFocus: FocusEventHandler<HTMLElement>;
    /** Blur handler for the tile root. */
    onBlur: FocusEventHandler<HTMLElement>;
    /** Context menu handler for the content region. */
    onContextMenu: MouseEventHandler<HTMLElement>;
};

/** Props consumed by {@link EventTileView}. */
export interface EventTileViewProps {
    /** Optional root element tag name override. */
    as?: string;
    /** Ref to the tile root element. */
    rootRef?: Ref<HTMLElement>;
    /** DOM ID for the main content region. */
    contentId: string;
    /** Optional event ID attached to the root element. */
    eventId?: string;
    /** Active room layout variant. */
    layout?: Layout;
    /** Timeline rendering mode for the current view. */
    timelineRenderingType: TimelineRenderingType;
    /** CSS class name for the tile root. */
    rootClassName: string;
    /** CSS class name for the tile content region. */
    contentClassName: string;
    /** Optional `aria-live` override. */
    ariaLive?: "off";
    /** DOM scroll tokens used by scroll-state restoration. */
    scrollTokens?: string;
    /** Whether the event belongs to the current user. */
    isOwnEvent: boolean;
    /** Structured content props for the tile body. */
    content: EventTileContentProps;
    /** Thread summary and toolbar props. */
    threads: EventTileThreadsProps;
    /** Timestamp props. */
    timestamp: EventTileTimestampProps;
    /** Encryption indicator props. */
    encryption: EventTileEncryptionProps;
    /** Notification-specific room metadata props. */
    notification: EventTileNotificationProps;
    /** DOM handlers for the tile. */
    handlers: EventTileHandlersProps;
}

/** Shared props for timestamp helper components. */
type PlainTimestampProps = {
    /** Timestamp props to render. */
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

/** Props for the event content wrapper region. */
type EventContentRegionProps = {
    /** Optional content region DOM ID. */
    contentId?: string;
    /** CSS class name for the content region. */
    contentClassName: string;
    /** Context menu handler for the content region. */
    onContextMenu: MouseEventHandler<HTMLElement>;
    /** Child nodes rendered inside the region. */
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

const FooterThreadMeta = memo(function FooterThreadMeta({
    footer,
    info,
}: {
    footer?: ReactNode;
    info?: ReactNode;
}): JSX.Element | null {
    if (!footer && !info) return null;

    return (
        <>
            {footer}
            {info}
        </>
    );
});

const ThreadsPanelRegion = memo(function ThreadsPanelRegion({
    replyCount,
    preview,
}: EventTileViewProps["threads"]): JSX.Element | null {
    if (replyCount === undefined && preview === undefined) {
        return null;
    }

    return (
        <>
            {replyCount !== undefined && preview !== undefined && (
                <ThreadPanelSummary replyCount={replyCount} preview={preview} />
            )}
        </>
    );
});

type ThreadTimelineContentProps = Pick<
    EventTileViewProps,
    "contentId" | "content" | "contentClassName" | "timestamp"
> & {
    onContextMenu: MouseEventHandler<HTMLElement>;
};

const ThreadTimelineContent = memo(function ThreadTimelineContent({
    contentId,
    content,
    contentClassName,
    timestamp,
    onContextMenu,
}: ThreadTimelineContentProps): JSX.Element {
    return (
        <>
            <div className="mx_EventTile_senderDetails">
                {content.avatar}
                {content.sender}
            </div>
            <EventContentRegion contentId={contentId} contentClassName={contentClassName} onContextMenu={onContextMenu}>
                {content.contextMenu}
                {content.replyChain}
                {content.messageBody}
                {content.actionBar}
                <LinkedTimestamp timestamp={timestamp} />
                {content.messageStatus}
            </EventContentRegion>
            <FooterThreadMeta footer={content.footer} />
        </>
    );
});

type ListTimelineContentProps = Pick<
    EventTileViewProps,
    "content" | "contentClassName" | "notification" | "threads" | "timestamp"
> & {
    onContextMenu: MouseEventHandler<HTMLElement>;
};

const ListTimelineContent = memo(function ListTimelineContent({
    content,
    contentClassName,
    notification,
    threads,
    timestamp,
    onContextMenu,
}: ListTimelineContentProps): JSX.Element {
    return (
        <>
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
            <EventContentRegion contentClassName={contentClassName} onContextMenu={onContextMenu}>
                <div className="mx_EventTile_body">{content.messageBody}</div>
                <ThreadsPanelRegion {...threads} />
            </EventContentRegion>
            {threads.toolbar}
            {content.messageStatus}
        </>
    );
});

type FileTimelineContentProps = Pick<EventTileViewProps, "content" | "contentClassName" | "timestamp"> & {
    onContextMenu: MouseEventHandler<HTMLElement>;
};

const FileTimelineContent = memo(function FileTimelineContent({
    content,
    contentClassName,
    timestamp,
    onContextMenu,
}: FileTimelineContentProps): JSX.Element {
    return (
        <>
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
            <EventContentRegion contentClassName={contentClassName} onContextMenu={onContextMenu}>
                {content.contextMenu}
                {content.messageBody}
            </EventContentRegion>
        </>
    );
});

type DefaultTimelineContentProps = Pick<
    EventTileViewProps,
    "contentId" | "content" | "contentClassName" | "encryption" | "layout" | "threads" | "timestamp"
> & {
    onContextMenu: MouseEventHandler<HTMLElement>;
};

const DefaultTimelineContent = memo(function DefaultTimelineContent({
    contentId,
    content,
    contentClassName,
    encryption,
    layout,
    threads,
    timestamp,
    onContextMenu,
}: DefaultTimelineContentProps): JSX.Element {
    return (
        <>
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
            <EventContentRegion contentId={contentId} contentClassName={contentClassName} onContextMenu={onContextMenu}>
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
        </>
    );
});

function EventTileViewComponent(props: Readonly<EventTileViewProps>): JSX.Element {
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
    const replyChain = content.replyChain;

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
                    <ThreadTimelineContent
                        contentId={contentId}
                        content={content}
                        contentClassName={contentClassName}
                        timestamp={timestamp}
                        onContextMenu={handlers.onContextMenu}
                    />
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
                    data-has-reply={!!replyChain}
                    data-event-id={eventId}
                    onMouseEnter={handlers.onMouseEnter}
                    onMouseLeave={handlers.onMouseLeave}
                    onFocus={handlers.onFocus}
                    onBlur={handlers.onBlur}
                    onClick={handlers.onClick}
                >
                    <ListTimelineContent
                        content={content}
                        contentClassName={contentClassName}
                        notification={notification}
                        threads={threads}
                        timestamp={timestamp}
                        onContextMenu={handlers.onContextMenu}
                    />
                </Root>
            );
        case TimelineRenderingType.File:
            return (
                <Root
                    className={rootClassName}
                    aria-live={ariaLive}
                    aria-atomic={true}
                    data-scroll-tokens={scrollTokens}
                    data-event-id={eventId}
                >
                    <FileTimelineContent
                        content={content}
                        contentClassName={contentClassName}
                        timestamp={timestamp}
                        onContextMenu={handlers.onContextMenu}
                    />
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
                    data-has-reply={!!replyChain}
                    onMouseEnter={handlers.onMouseEnter}
                    onMouseLeave={handlers.onMouseLeave}
                    onFocus={handlers.onFocus}
                    onBlur={handlers.onBlur}
                >
                    <DefaultTimelineContent
                        contentId={contentId}
                        content={content}
                        contentClassName={contentClassName}
                        encryption={encryption}
                        layout={layout}
                        threads={threads}
                        timestamp={timestamp}
                        onContextMenu={handlers.onContextMenu}
                    />
                </Root>
            );
    }
}

/** Memoized view component for rendering a single event tile. */
export const EventTileView = memo(EventTileViewComponent);
