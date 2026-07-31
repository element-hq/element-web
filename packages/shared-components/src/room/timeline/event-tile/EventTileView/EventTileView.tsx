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
 * Timeline-specific slot placement is added by the rendering-mode branches in
 * subsequent migration steps. The application supplies render-ready content;
 * this component owns only the shared structure and root behavior.
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
                    {slots.avatar}
                    {slots.sender}
                </div>
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {slots.contextMenu}
                    {slots.replyChain}
                    {slots.body}
                    {slots.actionBar}
                    {slots.timestamp}
                    {slots.receipt}
                </div>
                {slots.footer}
            </>,
            undefined,
        );
    }

    // Preview views: metadata, avatar, preview content, and optional actions.
    if (root.data.shape === "Notification" || root.data.shape === "ThreadsList") {
        return renderRoot(
            <>
                <div className={classNames(styles.details, classNameOverrides?.details)}>
                    {slots.sender}
                    {slots.notificationRoomLabel}
                    {slots.timestamp}
                    {slots.notificationBadge}
                </div>
                {root.data.shape === "Notification" && slots.roomAvatar ? (
                    <div className={classNames(styles.avatar, classNameOverrides?.avatar)}>{slots.roomAvatar}</div>
                ) : (
                    slots.avatar
                )}
                <div className={classNames(styles.line, classNameOverrides?.line)} id={root.id}>
                    {slots.body}
                    {slots.threadInfo}
                </div>
                {root.data.shape === "ThreadsList" && (
                    <div className={classNames(styles.threadListActionBar, classNameOverrides?.threadListActionBar)}>
                        {slots.actionBar}
                    </div>
                )}
                {slots.receipt}
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
                        {slots.avatar}
                        {slots.sender}
                        {slots.timestamp}
                    </div>
                </a>
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {slots.contextMenu}
                    {slots.body}
                </div>
            </>,
            undefined,
        );
    }

    // IRC layout: timestamp and sender details precede the line content.
    if (root.data.layout === "irc") {
        return renderRoot(
            <>
                {slots.timestamp}
                {slots.sender}
                {slots.padlock}
                {slots.avatar}
                <div
                    id={root.id}
                    className={classNames(styles.line, classNameOverrides?.line)}
                    onContextMenu={onContextMenu}
                >
                    {slots.contextMenu}
                    {slots.replyChain}
                    {slots.body}
                    {slots.actionBar}
                    {slots.footer}
                    {slots.threadInfo}
                </div>
                {slots.receipt}
            </>,
            undefined,
            -1,
        );
    }

    // Group and bubble layouts: sender details precede the line content.
    return renderRoot(
        <>
            {slots.sender}
            {slots.avatar}
            <div
                id={root.id}
                className={classNames(styles.line, classNameOverrides?.line)}
                onContextMenu={onContextMenu}
            >
                {slots.contextMenu}
                {slots.timestamp}
                {slots.padlock}
                {slots.replyChain}
                {slots.body}
                {slots.actionBar}
            </div>
            {slots.footer}
            {slots.threadInfo}
            {slots.receipt}
        </>,
        undefined,
        -1,
    );
}
