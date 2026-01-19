/*
 * Copyright 2026 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type JSX, type ReactNode } from "react";
import React from "react";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import styles from "./TimelineSeparatorView.module.css";


/**
 * Snapshot interface for the timeline separator view model.
 */
export interface TimelineSeparatorViewSnapshot {
    /**
     * Accessible label for the separator (for example: "Today", "Yesterday", or a date).
     */
    label: string;
    /**
     * Optional children to render inside the timeline separator (e.g. a label node).
     */
    children?: ReactNode;
}

/**
 * The view model for the timeline separator.
 */
export type TimelineSeparatorViewModel = ViewModel<TimelineSeparatorViewSnapshot>;

interface TimelineSeparatorViewProps {
    /**
     * The view model for the timeline separator.
     */
    vm: TimelineSeparatorViewModel;
}

/**
 * TimelineSeparator component renders a visual separator inside the message timeline.
 * It draws horizontal rules with an accessible label and optional children rendered between them.
 * The component expects a view model that provides the label and any children to render.
 *
 * @example
 * ```tsx
 * @param label the accessible label string describing the separator (used for `aria-label`)
 * @param children optional React nodes to render between the separators
 * ```
 */
export function TimelineSeparatorView({ vm }: Readonly<TimelineSeparatorViewProps>): JSX.Element {
    const {
        label, children,
    } = useViewModel<TimelineSeparatorViewSnapshot>(vm);

    return (
        <div className={styles.mx_TimelineSeparator} role="separator" aria-label={label}>
            <hr role="none" />
            {children}
            <hr role="none" />
        </div>
    );
}
