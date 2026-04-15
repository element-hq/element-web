/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler } from "react";
import classNames from "classnames";
import { Button } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import styles from "./TileErrorView.module.css";

export type TileErrorViewLayout = "bubble" | "group" | "irc";

export interface TileErrorViewSnapshot {
    /**
     * Layout variant used by the host timeline.
     */
    layout?: TileErrorViewLayout;
    /**
     * Primary fallback text shown when a tile fails to render.
     */
    message: string;
    /**
     * Optional event type appended to the fallback text.
     */
    eventType?: string;
    /**
     * Optional label for the bug-report action button.
     */
    bugReportCtaLabel?: string;
    /**
     * Optional label for the view-source action.
     */
    viewSourceCtaLabel?: string;
}

export interface TileErrorViewActions {
    /**
     * Invoked when the bug-report button is clicked.
     */
    onBugReportClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * Invoked when the view-source action is clicked.
     */
    onViewSourceClick?: MouseEventHandler<HTMLButtonElement>;
}

export type TileErrorViewModel = ViewModel<TileErrorViewSnapshot, TileErrorViewActions>;

interface TileErrorViewProps {
    /**
     * The view model for the tile error fallback.
     */
    vm: TileErrorViewModel;
    /**
     * Optional host-level class names.
     */
    className?: string;
}

/**
 * Renders a timeline tile fallback when message content cannot be displayed.
 *
 * The component shows the fallback error message from the view model, optionally
 * appends the event type in parentheses, and can render bug-report and view-source
 * actions when their labels are provided. The layout in the view-model snapshot
 * selects the timeline presentation variant.
 */
export function TileErrorView({ vm, className }: Readonly<TileErrorViewProps>): JSX.Element {
    const { message, eventType, bugReportCtaLabel, viewSourceCtaLabel, layout = "group" } = useViewModel(vm);

    return (
        <li
            className={classNames(styles.tileErrorView, className, { [styles.bubble]: layout === "bubble" })}
            data-layout={layout}
        >
            <div className={styles.line} role="status">
                <span className={styles.message}>
                    {message}
                    {eventType && ` (${eventType})`}
                </span>
                {bugReportCtaLabel && (
                    <Button kind="secondary" size="sm" onClick={vm.onBugReportClick}>
                        {bugReportCtaLabel}
                    </Button>
                )}
                {viewSourceCtaLabel && (
                    <button type="button" className={styles.viewSourceButton} onClick={vm.onViewSourceClick}>
                        {viewSourceCtaLabel}
                    </button>
                )}
            </div>
        </li>
    );
}
