/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";

import type { EventTileViewProps } from "./EventTileView.types";
import styles from "./EventTileView.module.css";

/**
 * Renders the common EventTile root and event-line structure.
 *
 * Rendering-mode branches own the timeline-specific slot placement. The
 * application supplies render-ready content; this component owns the shared
 * structure, placement classes, and root behavior.
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
        content: React.ReactNode,
        slotClassName?: string,
        overrideClassName?: string,
    ): React.ReactNode => {
        if (!React.isValidElement<{ className?: string }>(content) || content.type === React.Fragment) return content;

        return React.cloneElement(content, {
            className: classNames(content.props.className, slotClassName, overrideClassName),
        });
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
                    {renderSlot(slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                    {renderSlot(slots.sender, styles.sender, classNameOverrides?.sender)}
                </div>
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot(slots.contextMenu, styles.contextMenu, classNameOverrides?.contextMenu)}
                    {renderSlot(slots.replyChain, styles.replyChain, classNameOverrides?.replyChain)}
                    {renderSlot(slots.body, styles.body, classNameOverrides?.body)}
                    {renderSlot(slots.actionBar, styles.actionBar, classNameOverrides?.actionBar)}
                    {renderSlot(slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                    {renderSlot(slots.receipt, styles.receipt, classNameOverrides?.receipt)}
                </div>
                {renderSlot(slots.footer, styles.footer, classNameOverrides?.footer)}
            </>,
            undefined,
        );
    }

    // Notification view: metadata, room avatar, and preview content.
    if (root.data.shape === "Notification") {
        return renderRoot(
            <>
                <div className={classNames(styles.details, classNameOverrides?.details)}>
                    {renderSlot(slots.sender, styles.sender, classNameOverrides?.sender)}
                    {renderSlot(
                        slots.notificationRoomLabel,
                        styles.notificationRoomLabel,
                        classNameOverrides?.notificationRoomLabel,
                    )}
                    {renderSlot(slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                    {renderSlot(
                        slots.notificationBadge,
                        styles.notificationBadge,
                        classNameOverrides?.notificationBadge,
                    )}
                </div>
                {slots.roomAvatar
                    ? renderSlot(slots.roomAvatar, styles.avatar, classNameOverrides?.avatar)
                    : renderSlot(slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                <div className={classNames(styles.line, classNameOverrides?.line)} id={root.id}>
                    {renderSlot(slots.body, styles.body, classNameOverrides?.body)}
                    {renderSlot(slots.threadInfo, styles.threadInfo, classNameOverrides?.threadInfo)}
                </div>
                {renderSlot(slots.receipt, styles.receipt, classNameOverrides?.receipt)}
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
                    {renderSlot(slots.sender, styles.sender, classNameOverrides?.sender)}
                    {renderSlot(
                        slots.notificationRoomLabel,
                        styles.notificationRoomLabel,
                        classNameOverrides?.notificationRoomLabel,
                    )}
                    {renderSlot(slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                    {renderSlot(
                        slots.notificationBadge,
                        styles.notificationBadge,
                        classNameOverrides?.notificationBadge,
                    )}
                </div>
                {renderSlot(slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                <div className={classNames(styles.line, classNameOverrides?.line)} id={root.id}>
                    {renderSlot(slots.body, styles.body, classNameOverrides?.body)}
                    {renderSlot(slots.threadInfo, styles.threadInfo, classNameOverrides?.threadInfo)}
                </div>
                {renderSlot(slots.actionBar, styles.actionBar, classNameOverrides?.actionBar)}
                {renderSlot(slots.receipt, styles.receipt, classNameOverrides?.receipt)}
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
                        {renderSlot(slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                        {renderSlot(slots.sender, styles.sender, classNameOverrides?.sender)}
                        {renderSlot(slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                    </div>
                </a>
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot(slots.contextMenu, styles.contextMenu, classNameOverrides?.contextMenu)}
                    {renderSlot(slots.body, styles.body, classNameOverrides?.body)}
                </div>
            </>,
            undefined,
        );
    }

    // IRC layout: timestamp and sender details precede the line content.
    if (root.data.layout === "irc") {
        return renderRoot(
            <>
                {renderSlot(slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                {renderSlot(slots.padlock, styles.padlock, classNameOverrides?.padlock)}
                {renderSlot(slots.avatar, styles.avatar, classNameOverrides?.avatar)}
                {renderSlot(slots.sender, styles.sender, classNameOverrides?.sender)}
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot(slots.contextMenu, styles.contextMenu, classNameOverrides?.contextMenu)}
                    {renderSlot(slots.replyChain, styles.replyChain, classNameOverrides?.replyChain)}
                    {renderSlot(slots.body, styles.body, classNameOverrides?.body)}
                    {renderSlot(slots.actionBar, styles.actionBar, classNameOverrides?.actionBar)}
                    {renderSlot(slots.footer, styles.footer, classNameOverrides?.footer)}
                    {renderSlot(slots.threadInfo, styles.threadInfo, classNameOverrides?.threadInfo)}
                </div>
                {renderSlot(slots.receipt, styles.receipt, classNameOverrides?.receipt)}
            </>,
            undefined,
            -1,
        );
    }

    // Group and bubble layouts: sender details precede the line content.
    return renderRoot(
        <>
            {renderSlot(slots.sender, styles.sender, classNameOverrides?.sender)}
            {renderSlot(slots.avatar, styles.avatar, classNameOverrides?.avatar)}
            <div
                id={root.id}
                className={classNames(styles.line, classNameOverrides?.line)}
                onContextMenu={onContextMenu}
            >
                {renderSlot(slots.contextMenu, styles.contextMenu, classNameOverrides?.contextMenu)}
                {renderSlot(slots.timestamp, styles.timestamp, classNameOverrides?.timestamp)}
                {renderSlot(slots.padlock, styles.padlock, classNameOverrides?.padlock)}
                {renderSlot(slots.replyChain, styles.replyChain, classNameOverrides?.replyChain)}
                {renderSlot(slots.body, styles.body, classNameOverrides?.body)}
                {renderSlot(slots.actionBar, styles.actionBar, classNameOverrides?.actionBar)}
            </div>
            {renderSlot(slots.footer, styles.footer, classNameOverrides?.footer)}
            {renderSlot(slots.threadInfo, styles.threadInfo, classNameOverrides?.threadInfo)}
            {renderSlot(slots.receipt, styles.receipt, classNameOverrides?.receipt)}
        </>,
        undefined,
        -1,
    );
}
