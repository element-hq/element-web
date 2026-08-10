/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";

import type { EventTileViewProps, EventTileViewSlots } from "./EventTileView.types";
import styles from "./EventTileView.module.css";

type EventTileSlotName = keyof EventTileViewSlots;

/**
 * Renders the common EventTile root and event-line structure.
 *
 * Rendering-mode branches own the timeline-specific slot placement. The
 * application supplies render-ready content; this component owns the shared
 * structure, slot boundaries, placement classes, and root behavior.
 */
export function EventTileView({
    root,
    slots,
    classNames: classNameOverrides,
    refs,
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onClick,
    onContextMenu,
    onPermalinkClick,
    onPermalinkContextMenu,
}: Readonly<EventTileViewProps>): JSX.Element {
    const Root = root.as ?? "li";

    const renderSlot = (
        slotName: EventTileSlotName,
        content: React.ReactNode,
        slotClassName?: string,
        overrideClassName?: string,
    ): React.ReactNode => {
        if (content === null || content === undefined || typeof content === "boolean") return null;

        return (
            <div data-event-tile-slot={slotName} className={classNames(slotClassName, overrideClassName)}>
                {content}
            </div>
        );
    };

    const renderRoot = (
        children: React.ReactNode,
        rootClickHandler: React.MouseEventHandler<HTMLElement> | undefined,
        rootTabIndex?: number,
    ): JSX.Element => (
        <Root
            ref={refs?.root}
            className={classNames(styles.root, classNameOverrides?.root)}
            aria-live={root.ariaLive}
            aria-atomic={true}
            data-scroll-tokens={root.scrollToken}
            data-event-id={root.data.eventId}
            data-layout={root.data.layout}
            data-shape={root.data.shape}
            data-self={root.data.isOwnEvent}
            data-has-reply={root.data.hasReply}
            data-highlighted={root.state?.highlighted || undefined}
            data-selected={root.state?.selected || undefined}
            data-editing={root.state?.editing || undefined}
            data-continuation={root.state?.continuation || undefined}
            data-last-in-section={root.state?.lastInSection || undefined}
            tabIndex={rootTabIndex}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus}
            onBlur={onBlur}
            onClick={rootClickHandler}
        >
            {children}
        </Root>
    );

    // Thread view: sender details, line content, then footer.
    if (root.data.shape === "Thread") {
        return renderRoot(
            <>
                <div className={classNames(styles.senderDetails, classNameOverrides?.senderDetails)}>
                    {renderSlot("avatar", slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                    {renderSlot("sender", slots.sender, styles.sender, classNameOverrides?.sender)}
                </div>
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot("contextMenu", slots.contextMenu, styles.contextMenu, classNameOverrides?.contextMenu)}
                    {renderSlot("replyChain", slots.replyChain, styles.replyChain, classNameOverrides?.replyChain)}
                    {renderSlot("body", slots.body, styles.body, classNameOverrides?.body)}
                    {renderSlot("actionBar", slots.actionBar, styles.actionBar, classNameOverrides?.actionBar)}
                    {renderSlot("timestamp", slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                    {renderSlot("receipt", slots.receipt, styles.receipt, classNameOverrides?.receipt)}
                </div>
                {renderSlot("footer", slots.footer, styles.footer, classNameOverrides?.footer)}
            </>,
            undefined,
        );
    }

    // Notification view: metadata, room avatar, and preview content.
    if (root.data.shape === "Notification") {
        return renderRoot(
            <>
                <div className={classNames(styles.details, classNameOverrides?.details)}>
                    {renderSlot("sender", slots.sender, styles.sender, classNameOverrides?.sender)}
                    {renderSlot(
                        "notificationRoomLabel",
                        slots.notificationRoomLabel,
                        styles.notificationRoomLabel,
                        classNameOverrides?.notificationRoomLabel,
                    )}
                    {renderSlot("timestamp", slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                    {renderSlot(
                        "notificationBadge",
                        slots.notificationBadge,
                        styles.notificationBadge,
                        classNameOverrides?.notificationBadge,
                    )}
                </div>
                {slots.roomAvatar
                    ? renderSlot("roomAvatar", slots.roomAvatar, styles.avatar, classNameOverrides?.avatar)
                    : renderSlot("avatar", slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                <div className={classNames(styles.line, classNameOverrides?.line)} id={root.id}>
                    {renderSlot("body", slots.body, styles.body, classNameOverrides?.body)}
                    {renderSlot("threadInfo", slots.threadInfo, styles.threadInfo, classNameOverrides?.threadInfo)}
                </div>
                {renderSlot("receipt", slots.receipt, styles.receipt, classNameOverrides?.receipt)}
            </>,
            onClick,
            -1,
        );
    }

    // ThreadsList view: metadata, avatar, preview content, and action bar.
    if (root.data.shape === "ThreadsList") {
        return renderRoot(
            <>
                <div className={classNames(styles.details, classNameOverrides?.details)}>
                    {renderSlot("sender", slots.sender, styles.sender, classNameOverrides?.sender)}
                    {renderSlot(
                        "notificationRoomLabel",
                        slots.notificationRoomLabel,
                        styles.notificationRoomLabel,
                        classNameOverrides?.notificationRoomLabel,
                    )}
                    {renderSlot("timestamp", slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                    {renderSlot(
                        "notificationBadge",
                        slots.notificationBadge,
                        styles.notificationBadge,
                        classNameOverrides?.notificationBadge,
                    )}
                </div>
                {renderSlot("avatar", slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                <div className={classNames(styles.line, classNameOverrides?.line)} id={root.id}>
                    {renderSlot("body", slots.body, styles.body, classNameOverrides?.body)}
                    {renderSlot("threadInfo", slots.threadInfo, styles.threadInfo, classNameOverrides?.threadInfo)}
                </div>
                {renderSlot("actionBar", slots.actionBar, styles.actionBar, classNameOverrides?.actionBar)}
                {renderSlot("receipt", slots.receipt, styles.receipt, classNameOverrides?.receipt)}
            </>,
            onClick,
            -1,
        );
    }

    // File view: permalink-wrapped sender details followed by the file body.
    if (root.data.shape === "File") {
        return renderRoot(
            <>
                <a
                    className={classNames(styles.senderDetailsLink, classNameOverrides?.senderDetailsLink)}
                    href={root.permalink ?? "#"}
                    onClick={onPermalinkClick}
                >
                    <div
                        className={classNames(styles.senderDetails, classNameOverrides?.senderDetails)}
                        onContextMenu={onPermalinkContextMenu}
                    >
                        {renderSlot("avatar", slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                        {renderSlot("sender", slots.sender, styles.sender, classNameOverrides?.sender)}
                        {renderSlot("timestamp", slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                    </div>
                </a>
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot("contextMenu", slots.contextMenu, styles.contextMenu, classNameOverrides?.contextMenu)}
                    {renderSlot("body", slots.body, styles.body, classNameOverrides?.body)}
                </div>
            </>,
            undefined,
        );
    }

    // Default shape: Pinned, Room, Search

    // IRC layout: the leading metadata slots precede the line content.
    if (root.data.layout === "irc") {
        return renderRoot(
            <>
                {renderSlot("padlock", slots.padlock, styles.padlock, classNameOverrides?.padlock)}
                {renderSlot("timestamp", slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                {renderSlot("avatar", slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                {renderSlot("sender", slots.sender, styles.sender, classNameOverrides?.sender)}
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot("contextMenu", slots.contextMenu, styles.contextMenu, classNameOverrides?.contextMenu)}
                    {renderSlot("replyChain", slots.replyChain, styles.replyChain, classNameOverrides?.replyChain)}
                    {renderSlot("body", slots.body, styles.body, classNameOverrides?.body)}
                    {renderSlot("actionBar", slots.actionBar, styles.actionBar, classNameOverrides?.actionBar)}
                    {renderSlot("footer", slots.footer, styles.footer, classNameOverrides?.footer)}
                    {renderSlot("threadInfo", slots.threadInfo, styles.threadInfo, classNameOverrides?.threadInfo)}
                </div>
                {renderSlot("receipt", slots.receipt, styles.receipt, classNameOverrides?.receipt)}
            </>,
            undefined,
            -1,
        );
    }

    // Group and bubble layouts: sender details precede the line content.
    return renderRoot(
        <>
            {renderSlot("sender", slots.sender, styles.sender, classNameOverrides?.sender)}
            {renderSlot("avatar", slots.avatar, styles.avatar, classNameOverrides?.avatar)}
            <div
                id={root.id}
                className={classNames(styles.line, classNameOverrides?.line)}
                onContextMenu={onContextMenu}
            >
                {renderSlot("contextMenu", slots.contextMenu, styles.contextMenu, classNameOverrides?.contextMenu)}
                {renderSlot("timestamp", slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                {renderSlot("padlock", slots.padlock, styles.padlock, classNameOverrides?.padlock)}
                {renderSlot("replyChain", slots.replyChain, styles.replyChain, classNameOverrides?.replyChain)}
                {renderSlot("body", slots.body, styles.body, classNameOverrides?.body)}
                {renderSlot("actionBar", slots.actionBar, styles.actionBar, classNameOverrides?.actionBar)}
            </div>
            {renderSlot("footer", slots.footer, styles.footer, classNameOverrides?.footer)}
            {renderSlot("threadInfo", slots.threadInfo, styles.threadInfo, classNameOverrides?.threadInfo)}
            {renderSlot("receipt", slots.receipt, styles.receipt, classNameOverrides?.receipt)}
        </>,
        undefined,
        -1,
    );
}
