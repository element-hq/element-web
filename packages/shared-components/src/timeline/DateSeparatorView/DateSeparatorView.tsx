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
    label: string;
    /**
     * Extra CSS classes to apply to the component
     */
    className?: string;
    jumpToDateMenu?: JSX.Element;
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
 * A placeholder element for date separator
 *
 * @example
 * ```tsx
 * <DateSeparatorView vm={DateSeparatorViewModel} />
 * ```
 */
export function DateSeparatorView({ vm }: Readonly<DateSeparatorViewProps>): JSX.Element {
    const { label, className, jumpToDateMenu } = useViewModel(vm);

    const dateHeaderContent = (
        <div className={styles.dateContent}>
            <h2 className={styles.dateHeading} aria-hidden="true">
                {label}
            </h2>
        </div>
    );

    return (
        <TimelineSeparator label={label} className={classNames(className)}>
            {jumpToDateMenu || dateHeaderContent}
        </TimelineSeparator>
    );
}
