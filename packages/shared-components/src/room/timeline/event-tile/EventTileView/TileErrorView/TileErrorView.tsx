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
import { useEventPresentation } from "../../../EventPresentation";
import styles from "./TileErrorView.module.css";

/** Snapshot data for rendering an event tile error fallback. */
export interface TileErrorViewSnapshot {
    /** Primary fallback text shown when a tile fails to render. */
    message: string;
    /** Optional event type appended to the fallback text. */
    eventType?: string;
    /** Optional label for the bug-report action button. */
    bugReportCtaLabel?: string;
    /** Optional label for the view-source action. */
    viewSourceCtaLabel?: string;
}

/** User actions emitted by the tile error fallback. */
export interface TileErrorViewActions {
    /** Invoked when the bug-report button is clicked. */
    onBugReportClick?: MouseEventHandler<HTMLButtonElement>;
    /** Invoked when the view-source action is clicked. */
    onViewSourceClick?: MouseEventHandler<HTMLButtonElement>;
}

/** View model contract for the tile error fallback. */
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
 * actions when their labels are provided.
 */
export function TileErrorView({ vm, className }: Readonly<TileErrorViewProps>): JSX.Element {
    const { layout } = useEventPresentation();
    const { message, eventType, bugReportCtaLabel, viewSourceCtaLabel } = useViewModel(vm);

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
                    <Button kind="secondary" size="md" onClick={vm.onBugReportClick}>
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
