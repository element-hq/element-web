/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { PropsWithChildren, type JSX } from "react";
import React from "react";
import classNames from "classnames";

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
     * Optional children to render inside the timeline separator
     */
    children?: PropsWithChildren["children"];
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
 * TimelineSeparatorView component renders a visual separator inside the message timeline.
 * It draws horizontal rules with an accessible label and optional children rendered between them.
 *
 * @param label the accessible label string describing the separator (used for `aria-label`)
 * @param children optional React nodes to render between the separators
 * 
 */
export function TimelineSeparatorView({ vm }: Readonly<TimelineSeparatorViewProps>): JSX.Element {
    const {
        label, children,
    } = useViewModel(vm);

    // Keep mx_TimelineSeparator to support the compatibility with existing timeline and the all the layout
    return (
        <div className={classNames("mx_TimelineSeparator", styles.timelineSeparator)} role="separator" aria-label={label}>
            <hr role="none" />
            {children}
            <hr role="none" />
        </div>
    );
}
