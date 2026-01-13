/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";
import { JSX, type ReactNode } from "react";
import styles from "./TimelineSeparatorView.module.css";
import React from "react";


export const enum SeparatorKind {
    None,
    Date,
    LateEvent,
}

/**
 * Snapshot interface for the timeline separator view model.
 */
export interface TimelineSeparatorViewSnapshot {
    /**
     * Accessible label for the separator (for example: "Today", "Yesterday", or a date).
     */
    label: string;
    /**
     * The kind of separator to render.
     */
    SeparatorKind: SeparatorKind;
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
