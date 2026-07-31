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
}: Readonly<EventTileViewProps>): JSX.Element {
    const Root = root.as ?? "li";

    const renderRoot = (children: React.ReactNode, rootClickHandler = onClick, rootTabIndex?: number): JSX.Element => (
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

    if (root.data.shape === "Notification" || root.data.shape === "ThreadsList") {
        return renderRoot(
            <>
                <div className={classNames(styles.details, classNameOverrides?.details)}>
                    {slots.sender}
                    {slots.notificationRoomLabel}
                    {slots.timestamp}
                    {slots.notificationBadge}
                </div>
                <div className={classNames(styles.avatar, classNameOverrides?.avatar)}>
                    {root.data.shape === "Notification" && slots.roomAvatar ? slots.roomAvatar : slots.avatar}
                </div>
                <div
                    className={classNames(styles.line, classNameOverrides?.line)}
                    id={root.id}
                    onContextMenu={onContextMenu}
                >
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

    return renderRoot(
        <div id={root.id} className={classNames(styles.line, classNameOverrides?.line)} onContextMenu={onContextMenu}>
            {slots.contextMenu}
            {slots.body}
        </div>,
    );
}
