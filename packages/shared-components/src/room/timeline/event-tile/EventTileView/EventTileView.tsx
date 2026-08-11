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
            className={classNames(styles.root, classNameOverrides?.root, {
                [styles.stateOwnEvent]: root.data.isOwnEvent,
                [styles.stateHasReply]: root.data.hasReply,
                [styles.stateHighlighted]: root.state?.highlighted,
                [styles.stateSelected]: root.state?.selected,
                [styles.stateEditing]: root.state?.editing,
                [styles.stateContinuation]: root.state?.continuation,
                [styles.stateLastInSection]: root.state?.lastInSection,
            })}
            aria-live={root.ariaLive}
            aria-atomic={true}
            data-scroll-tokens={root.scrollToken}
            data-event-id={root.data.eventId}
            data-layout={root.data.layout}
            data-shape={root.data.shape}
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
                    {renderSlot("avatar", slots.avatar, styles.slotAvatar, classNameOverrides?.slotAvatar)}
                    {renderSlot("sender", slots.sender, styles.slotSender, classNameOverrides?.slotSender)}
                </div>
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot("contextMenu", slots.contextMenu, styles.slotContextMenu, classNameOverrides?.slotContextMenu)}
                    {renderSlot("replyChain", slots.replyChain, styles.slotReplyChain, classNameOverrides?.slotReplyChain)}
                    {renderSlot("body", slots.body, styles.slotBody, classNameOverrides?.slotBody)}
                    {renderSlot("actionBar", slots.actionBar, styles.slotActionBar, classNameOverrides?.slotActionBar)}
                    {renderSlot("timestamp", slots.timestamp, styles.slotTimestamp, classNameOverrides?.slotTimestamp)}
                    {renderSlot("receipt", slots.receipt, styles.slotReceipt, classNameOverrides?.slotReceipt)}
                </div>
                {renderSlot("footer", slots.footer, styles.slotFooter, classNameOverrides?.slotFooter)}
            </>,
            undefined,
        );
    }

    // Notification view: metadata, room avatar, and preview content.
    if (root.data.shape === "Notification") {
        return renderRoot(
            <>
                <div className={classNames(styles.details, classNameOverrides?.details)}>
                    {renderSlot("sender", slots.sender, styles.slotSender, classNameOverrides?.slotSender)}
                    {renderSlot(
                        "notificationRoomLabel",
                        slots.notificationRoomLabel,
                        styles.slotNotificationRoomLabel,
                        classNameOverrides?.slotNotificationRoomLabel,
                    )}
                    {renderSlot("timestamp", slots.timestamp, styles.slotTimestamp, classNameOverrides?.slotTimestamp)}
                    {renderSlot(
                        "notificationBadge",
                        slots.notificationBadge,
                        styles.slotNotificationBadge,
                        classNameOverrides?.slotNotificationBadge,
                    )}
                </div>
                {slots.roomAvatar
                    ? renderSlot("roomAvatar", slots.roomAvatar, styles.slotAvatar, classNameOverrides?.slotAvatar)
                    : renderSlot("avatar", slots.avatar, styles.slotAvatar, classNameOverrides?.slotAvatar)}
                <div className={classNames(styles.line, classNameOverrides?.line)} id={root.id}>
                    {renderSlot("body", slots.body, styles.slotBody, classNameOverrides?.slotBody)}
                    {renderSlot("threadInfo", slots.threadInfo, styles.slotThreadInfo, classNameOverrides?.slotThreadInfo)}
                </div>
                {renderSlot("receipt", slots.receipt, styles.slotReceipt, classNameOverrides?.slotReceipt)}
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
                    {renderSlot("sender", slots.sender, styles.slotSender, classNameOverrides?.slotSender)}
                    {renderSlot(
                        "notificationRoomLabel",
                        slots.notificationRoomLabel,
                        styles.slotNotificationRoomLabel,
                        classNameOverrides?.slotNotificationRoomLabel,
                    )}
                    {renderSlot("timestamp", slots.timestamp, styles.slotTimestamp, classNameOverrides?.slotTimestamp)}
                    {renderSlot(
                        "notificationBadge",
                        slots.notificationBadge,
                        styles.slotNotificationBadge,
                        classNameOverrides?.slotNotificationBadge,
                    )}
                </div>
                {renderSlot("avatar", slots.avatar, styles.slotAvatar, classNameOverrides?.slotAvatar)}
                <div className={classNames(styles.line, classNameOverrides?.line)} id={root.id}>
                    {renderSlot("body", slots.body, styles.slotBody, classNameOverrides?.slotBody)}
                    {renderSlot("threadInfo", slots.threadInfo, styles.slotThreadInfo, classNameOverrides?.slotThreadInfo)}
                </div>
                {renderSlot("actionBar", slots.actionBar, styles.slotActionBar, classNameOverrides?.slotActionBar)}
                {renderSlot("receipt", slots.receipt, styles.slotReceipt, classNameOverrides?.slotReceipt)}
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
                        {renderSlot("avatar", slots.avatar, styles.slotAvatar, classNameOverrides?.slotAvatar)}
                        {renderSlot("sender", slots.sender, styles.slotSender, classNameOverrides?.slotSender)}
                        {renderSlot("timestamp", slots.timestamp, styles.slotTimestamp, classNameOverrides?.slotTimestamp)}
                    </div>
                </a>
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot("contextMenu", slots.contextMenu, styles.slotContextMenu, classNameOverrides?.slotContextMenu)}
                    {renderSlot("body", slots.body, styles.slotBody, classNameOverrides?.slotBody)}
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
                {renderSlot("padlock", slots.padlock, styles.slotPadlock, classNameOverrides?.slotPadlock)}
                {renderSlot("timestamp", slots.timestamp, styles.slotTimestamp, classNameOverrides?.slotTimestamp)}
                {renderSlot("avatar", slots.avatar, styles.slotAvatar, classNameOverrides?.slotAvatar)}
                {renderSlot("sender", slots.sender, styles.slotSender, classNameOverrides?.slotSender)}
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {renderSlot("contextMenu", slots.contextMenu, styles.slotContextMenu, classNameOverrides?.slotContextMenu)}
                    {renderSlot("replyChain", slots.replyChain, styles.slotReplyChain, classNameOverrides?.slotReplyChain)}
                    {renderSlot("body", slots.body, styles.slotBody, classNameOverrides?.slotBody)}
                    {renderSlot("actionBar", slots.actionBar, styles.slotActionBar, classNameOverrides?.slotActionBar)}
                    {renderSlot("footer", slots.footer, styles.slotFooter, classNameOverrides?.slotFooter)}
                    {renderSlot("threadInfo", slots.threadInfo, styles.slotThreadInfo, classNameOverrides?.slotThreadInfo)}
                </div>
                {renderSlot("receipt", slots.receipt, styles.slotReceipt, classNameOverrides?.slotReceipt)}
            </>,
            undefined,
            -1,
        );
    }

    // Group and bubble layouts: sender details precede the line content.
    return renderRoot(
        <>
            {renderSlot("sender", slots.sender, styles.slotSender, classNameOverrides?.slotSender)}
            {renderSlot("avatar", slots.avatar, styles.slotAvatar, classNameOverrides?.slotAvatar)}
            <div
                id={root.id}
                className={classNames(styles.line, classNameOverrides?.line)}
                onContextMenu={onContextMenu}
            >
                {renderSlot("contextMenu", slots.contextMenu, styles.slotContextMenu, classNameOverrides?.slotContextMenu)}
                {renderSlot("timestamp", slots.timestamp, styles.slotTimestamp, classNameOverrides?.slotTimestamp)}
                {renderSlot("padlock", slots.padlock, styles.slotPadlock, classNameOverrides?.slotPadlock)}
                {renderSlot("replyChain", slots.replyChain, styles.slotReplyChain, classNameOverrides?.slotReplyChain)}
                {renderSlot("body", slots.body, styles.slotBody, classNameOverrides?.slotBody)}
                {renderSlot("actionBar", slots.actionBar, styles.slotActionBar, classNameOverrides?.slotActionBar)}
            </div>
            {renderSlot("footer", slots.footer, styles.slotFooter, classNameOverrides?.slotFooter)}
            {renderSlot("threadInfo", slots.threadInfo, styles.slotThreadInfo, classNameOverrides?.slotThreadInfo)}
            {renderSlot("receipt", slots.receipt, styles.slotReceipt, classNameOverrides?.slotReceipt)}
        </>,
        undefined,
        -1,
    );
}
