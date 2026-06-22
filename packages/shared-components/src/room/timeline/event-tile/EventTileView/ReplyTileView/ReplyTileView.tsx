/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020, 2021 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler, type ReactNode, useRef } from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./ReplyTileView.module.css";

/** Snapshot data for rendering a compact replied-to event tile. */
export interface ReplyTileViewSnapshot {
    /** Link target for the replied-to event. */
    permalink: string;
    /** Whether the event should use compact inline layout. */
    isInline: boolean;
    /** Whether the replied-to event is rendered as an informational event. */
    isInfoMessage: boolean;
    /** Whether the sender slot should be rendered. */
    showSender: boolean;
    /** Whether the body slot should be constrained to the compact text preview treatment. */
    shouldClampContent?: boolean;
    /** Fallback text shown when the event has no renderer. */
    noRendererMessage?: string;
}

/** User actions emitted by the reply tile. */
export interface ReplyTileViewActions {
    /** Invoked when the user activates the reply tile link itself. */
    onClick: MouseEventHandler<HTMLAnchorElement>;
}

/** View model contract for a compact replied-to event tile. */
export type ReplyTileViewModel = ViewModel<ReplyTileViewSnapshot, ReplyTileViewActions>;

interface ReplyTileViewProps {
    /** The view model for the reply tile. */
    vm: ReplyTileViewModel;
    /** Optional sender slot rendered above or beside the body. */
    sender?: ReactNode;
    /** Replied-to event body slot. */
    children?: ReactNode;
    /** Optional host-level class names. */
    className?: string;
}

/**
 * Renders the compact event tile used for message replies.
 *
 * The view owns the layout, styling, and nested-link click filtering. The app
 * supplies sender/body slots and handles navigation through the view model.
 */
export function ReplyTileView({ vm, sender, children, className }: Readonly<ReplyTileViewProps>): JSX.Element {
    const { permalink, isInline, isInfoMessage, showSender, shouldClampContent = false, noRendererMessage } =
        useViewModel(vm);
    const anchorElement = useRef<HTMLAnchorElement>(null);

    const classes = classNames(styles.replyTile, className, {
        [styles.inline]: isInline,
        [styles.info]: isInfoMessage,
    });
    const bodyClasses = classNames(styles.body, {
        [styles.clampedBody]: shouldClampContent,
    });

    if (noRendererMessage) {
        return (
            <div className={classNames(styles.replyTile, styles.info, styles.notice, className)} data-reply-tile="">
                {noRendererMessage}
            </div>
        );
    }

    const onClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
        const clickTarget = event.target as HTMLElement;
        const closestAnchor = clickTarget.closest("a");

        // Let nested links inside the body behave like normal links. Activating
        // the wrapping reply link should route to the replied-to event instead.
        if (closestAnchor && closestAnchor !== anchorElement.current) return;

        event.preventDefault();
        vm.onClick(event);
    };

    return (
        <div className={classes} data-reply-tile="">
            <a href={permalink} onClick={onClick} ref={anchorElement}>
                {showSender && sender && (
                    <div className={styles.sender} data-reply-tile-sender="">
                        {sender}
                    </div>
                )}
                <div className={bodyClasses} data-reply-tile-content="">
                    {children}
                </div>
            </a>
        </div>
    );
}
