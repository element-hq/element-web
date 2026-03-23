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
import { type EventStatus, type MatrixEvent, type Relations, type RoomMember } from "matrix-js-sdk/src/matrix";

import { TimelineRenderingType } from "../../../../contexts/RoomContext";
import { type IReadReceiptPosition } from "../ReadReceiptMarker";
import {
    PadlockMode,
    type AvatarSize,
    type EncryptionIndicatorMode,
    type SenderMode,
    TimestampDisplayMode,
    TimestampFormatMode,
} from "../../../../models/rooms/EventTileModel";
import { Layout } from "../../../../settings/enums/Layout";
import { type ButtonEvent } from "../../elements/AccessibleButton";
import { EncryptionIndicator } from "./EncryptionIndicator";
import { ThreadToolbar } from "./ThreadToolbar";
import { Timestamp } from "./Timestamp";
import { ThreadPanelSummary } from "./ThreadPanelSummary";
import { Sender } from "./Sender";
import { Avatar } from "./Avatar";
import { Footer } from "./Footer";
import { MessageStatus } from "./MessageStatus";
import { MessageBody, type MessageBodyProps } from "./MessageBody";
import { ReplyPreview, type ReplyPreviewProps } from "./ReplyPreview";
import { ContextMenu, type ContextMenuProps } from "./ContextMenu";
import { ActionBar, type ActionBarProps } from "./ActionBar";
import type { ReadReceiptProps } from "./types";

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
    sender?: {
        /** Sender presentation mode. */
        mode: SenderMode;
        /** Event whose sender should be rendered. */
        mxEvent: MatrixEvent;
        /** Optional sender click handler. */
        onClick?: () => void;
    };
    avatar?: {
        /** Room member to render for the avatar. */
        member?: RoomMember | null;
        /** Avatar size to render. */
        size: AvatarSize;
        /** Whether avatar clicks should open the user view. */
        viewUserOnClick: boolean;
        /** Whether historical member data should be preferred. */
        forceHistorical: boolean;
    };
    /** Reply preview props, when shown. */
    replyChain?: ReplyPreviewProps;
    /** Message body props for the event content. */
    messageBody: MessageBodyProps;
    /** Action bar props for the tile controls. */
    actionBar?: ActionBarProps;
    messageStatus?: {
        /** Local message send state. */
        messageState: EventStatus | undefined;
        /** Whether initial read receipt animations should be suppressed. */
        suppressReadReceiptAnimation: boolean;
        /** Whether the sent receipt state should be shown. */
        shouldShowSentReceipt: boolean;
        /** Whether the sending receipt state should be shown. */
        shouldShowSendingReceipt: boolean;
        /** Whether read receipts should be shown. */
        showReadReceipts: boolean;
        /** Read receipt entries for the tile. */
        readReceipts?: ReadReceiptProps[];
        /** Read receipt positions keyed by user ID. */
        readReceiptMap?: { [userId: string]: IReadReceiptPosition };
        /** Whether timestamps should use a twelve-hour clock. */
        isTwelveHour?: boolean;
        /** Optional callback used to detect unmounting during async work. */
        checkUnmounting?: () => boolean;
    };
    footer?: {
        /** Whether footer rendering is enabled. */
        enabled: boolean;
        /** Event associated with the footer. */
        mxEvent: MatrixEvent;
        /** Reactions to render in the footer. */
        reactions: Relations | null;
        /** Whether the event is redacted. */
        isRedacted?: boolean;
        /** Whether the event is pinned. */
        isPinned: boolean;
        /** Whether the event belongs to the current user. */
        isOwnEvent: boolean;
        /** Layout variant for the footer. */
        layout?: Layout;
        /** DOM ID of the tile content region. */
        tileContentId: string;
    };
    /** Context menu props when the menu is open. */
    contextMenu?: ContextMenuProps;
};

/** Non-null footer props extracted from {@link EventTileContentProps}. */
type EventTileFooterProps = NonNullable<EventTileContentProps["footer"]>;

/** Thread summary and toolbar props for the tile. */
type EventTileThreadsProps = {
    /** Inline thread metadata node. */
    info?: ReactNode;
    /** Reply count for the thread summary. */
    replyCount?: number;
    /** Thread preview node. */
    preview?: ReactNode;
    /** Whether the thread toolbar should be shown. */
    showToolbar?: boolean;
    /** Opens the thread in its room context. */
    openInRoom: (evt: ButtonEvent) => void;
    /** Copies a permalink to the thread. */
    copyLinkToThread: (evt: ButtonEvent) => void;
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
    /** Search scroll tokens used to restore timeline context. */
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

/** Props for the combined footer and thread metadata region. */
type FooterThreadMetaProps = {
    /** Footer props when footer rendering is enabled. */
    footer?: EventTileFooterProps;
    /** Additional thread metadata node. */
    info?: ReactNode;
};

const FooterThreadMeta = memo(function FooterThreadMeta({ footer, info }: FooterThreadMetaProps): JSX.Element | null {
    if (!footer?.enabled && !info) return null;

    return (
        <>
            {footer?.enabled && (
                <div className="mx_EventTile_footer">
                    <Footer
                        layout={footer.layout}
                        mxEvent={footer.mxEvent}
                        isRedacted={footer.isRedacted}
                        isPinned={footer.isPinned}
                        isOwnEvent={footer.isOwnEvent}
                        reactions={footer.reactions}
                        tileContentId={footer.tileContentId}
                    />
                </div>
            )}
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
    const sender = content.sender ? (
        <Sender mode={content.sender.mode} mxEvent={content.sender.mxEvent} onClick={content.sender.onClick} />
    ) : undefined;
    const avatar = content.avatar ? (
        <Avatar
            member={content.avatar.member}
            size={content.avatar.size}
            viewUserOnClick={content.avatar.viewUserOnClick}
            forceHistorical={content.avatar.forceHistorical}
        />
    ) : undefined;
    const replyChain = content.replyChain ? <ReplyPreview {...content.replyChain} /> : undefined;
    const actionBar = content.actionBar ? <ActionBar {...content.actionBar} /> : undefined;
    const messageStatus = content.messageStatus ? <MessageStatus {...content.messageStatus} /> : undefined;
    const messageBody = <MessageBody {...content.messageBody} />;
    const contextMenu = content.contextMenu ? <ContextMenu {...content.contextMenu} /> : undefined;

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
                        {avatar}
                        {sender}
                    </div>
                    <EventContentRegion
                        contentId={contentId}
                        contentClassName={contentClassName}
                        onContextMenu={handlers.onContextMenu}
                    >
                        {contextMenu}
                        {replyChain}
                        {messageBody}
                        {actionBar}
                        <LinkedTimestamp timestamp={timestamp} />
                        {messageStatus}
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
                    data-has-reply={!!replyChain}
                    data-event-id={eventId}
                    onMouseEnter={handlers.onMouseEnter}
                    onMouseLeave={handlers.onMouseLeave}
                    onFocus={handlers.onFocus}
                    onBlur={handlers.onBlur}
                    onClick={handlers.onClick}
                >
                    <div className="mx_EventTile_details">
                        {sender}
                        {notification.enabled && notification.roomLabel ? (
                            <span className="mx_EventTile_truncated">{notification.roomLabel}</span>
                        ) : (
                            ""
                        )}
                        <PlainTimestamp timestamp={timestamp} />
                        {notification.unreadBadge}
                    </div>
                    {notification.enabled && notification.roomAvatar ? notification.roomAvatar : avatar}
                    <EventContentRegion contentClassName={contentClassName} onContextMenu={handlers.onContextMenu}>
                        <div className="mx_EventTile_body">{messageBody}</div>
                        <ThreadsPanelRegion {...threads} />
                    </EventContentRegion>
                    {messageStatus}
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
                    <a
                        className="mx_EventTile_senderDetailsLink"
                        href={timestamp.permalink}
                        onClick={timestamp.onPermalinkClicked}
                    >
                        <div className="mx_EventTile_senderDetails" onContextMenu={timestamp.onContextMenu}>
                            {avatar}
                            {sender}
                            <PlainTimestamp timestamp={timestamp} />
                        </div>
                    </a>
                    <EventContentRegion contentClassName={contentClassName} onContextMenu={handlers.onContextMenu}>
                        {contextMenu}
                        {messageBody}
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
                    data-has-reply={!!replyChain}
                    onMouseEnter={handlers.onMouseEnter}
                    onMouseLeave={handlers.onMouseLeave}
                    onFocus={handlers.onFocus}
                    onBlur={handlers.onBlur}
                >
                    {layout === Layout.IRC && <LinkedTimestamp timestamp={timestamp} />}
                    {sender}
                    {encryption.padlockMode === PadlockMode.Irc && (
                        <EncryptionIndicator
                            icon={encryption.mode}
                            title={encryption.indicatorTitle}
                            sharedUserId={encryption.sharedKeysUserId}
                            roomId={encryption.sharedKeysRoomId}
                        />
                    )}
                    {avatar}
                    <EventContentRegion
                        contentId={contentId}
                        contentClassName={contentClassName}
                        onContextMenu={handlers.onContextMenu}
                    >
                        {contextMenu}
                        {layout !== Layout.IRC && <LinkedTimestamp timestamp={timestamp} />}
                        {encryption.padlockMode === PadlockMode.Group && (
                            <EncryptionIndicator
                                icon={encryption.mode}
                                title={encryption.indicatorTitle}
                                sharedUserId={encryption.sharedKeysUserId}
                                roomId={encryption.sharedKeysRoomId}
                            />
                        )}
                        {replyChain}
                        {messageBody}
                        {actionBar}
                        {layout === Layout.IRC && <FooterThreadMeta footer={content.footer} info={threads.info} />}
                    </EventContentRegion>
                    {layout !== Layout.IRC && <FooterThreadMeta footer={content.footer} info={threads.info} />}
                    {messageStatus}
                </Root>
            );
    }
}

/** Memoized view component for rendering a single event tile. */
export const EventTileView = memo(EventTileViewComponent);
