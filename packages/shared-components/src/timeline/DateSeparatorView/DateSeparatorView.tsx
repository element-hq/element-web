/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import classNames from "classnames";
import React, { type JSX } from "react";

import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../viewmodel/useViewModel";
import styles from "./DateSeparatorView.module.css";
import { TimelineSeparator } from "../../message-body/TimelineSeparator";

export interface DateSeparatorViewSnapshot {
    /**
     * Visible date label and the separator's accessible label.
     */
    label: string;
    /**
     * Extra CSS classes to apply to the component.
     */
    className?: string;
    /**
     * Optional custom header content (for example a jump-to-date menu trigger).
     * When provided, this replaces the default content.
     */
    headerContent?: JSX.Element;
}

/**
 * The view model for the component.
 */
export type DateSeparatorViewModel = ViewModel<DateSeparatorViewSnapshot>;

interface DateSeparatorViewProps {
    /**
     * The view model for the component.
     */
    vm: DateSeparatorViewModel;
}

/**
 * Renders a timeline date separator.
 * Uses `jumpToDateMenu` when present, otherwise renders the default date heading.
 *
 * @example
 * ```tsx
 * <DateSeparatorView vm={vm} />
 * ```
 */
export function DateSeparatorView({ vm }: Readonly<DateSeparatorViewProps>): JSX.Element {
    const { label, className, headerContent } = useViewModel(vm);

    const dateHeaderContent = (
        <div>
            <h2 aria-hidden="true">{label}</h2>
        </div>
    );

    return (
        <TimelineSeparator label={label} className={classNames(className, styles.separator)}>
            {headerContent || dateHeaderContent}
        </TimelineSeparator>
    );
}
