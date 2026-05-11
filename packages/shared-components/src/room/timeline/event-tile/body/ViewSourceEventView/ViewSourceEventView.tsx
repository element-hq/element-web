/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type MouseEventHandler, type Ref } from "react";
import classNames from "classnames";
import { CollapseIcon, ExpandIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Tooltip } from "@vector-im/compound-web";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { useI18n } from "../../../../../core/i18n/i18nContext";
import styles from "./ViewSourceEventView.module.css";

export interface ViewSourceEventViewSnapshot {
    /**
     * Whether the full event source is visible.
     */
    expanded: boolean;
    /**
     * Collapsed one-line event summary.
     */
    preview: string;
    /**
     * Pretty-printed event source.
     */
    source: string;
}

export interface ViewSourceEventViewActions {
    /**
     * Invoked when the user expands or collapses the event source.
     */
    onToggle: MouseEventHandler<HTMLButtonElement>;
}

export type ViewSourceEventViewModel = ViewModel<ViewSourceEventViewSnapshot, ViewSourceEventViewActions>;

interface ViewSourceEventViewProps {
    /**
     * ViewModel providing the event source snapshot and actions.
     */
    vm: ViewSourceEventViewModel;
    /**
     * Optional CSS class names applied to the root element.
     */
    className?: string;
    /**
     * Optional CSS class name applied to the root element while expanded.
     */
    expandedClassName?: string;
    /**
     * Optional ref forwarded to the root element.
     */
    ref?: Ref<HTMLSpanElement>;
}

/**
 * Renders a collapsible event source preview for hidden timeline events.
 */
export function ViewSourceEventView({
    vm,
    className,
    expandedClassName,
    ref,
}: Readonly<ViewSourceEventViewProps>): JSX.Element {
    const { expanded, preview, source } = useViewModel(vm);
    const _t = useI18n().translate;
    const toggleLabel = _t("devtools|toggle_event");

    const classes = classNames(
        styles.content,
        className,
        {
            [styles.expanded]: expanded,
        },
        expanded && expandedClassName,
    );

    return (
        <span className={classes} ref={ref}>
            {expanded ? (
                <pre className={styles.source}>{source}</pre>
            ) : (
                <code className={styles.source}>{preview}</code>
            )}
            <Tooltip description={toggleLabel} placement="top">
                <button type="button" aria-label={toggleLabel} className={styles.toggle} onClick={vm.onToggle}>
                    {expanded ? <CollapseIcon /> : <ExpandIcon />}
                </button>
            </Tooltip>
        </span>
    );
}
