/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import classNames from "classnames";

import styles from "./DurationView.module.css";
import { useViewModel, type ViewModel } from "../../../../../../../core/viewmodel";
import { Clock } from "../../../../../../../audio/Clock";

export interface DurationViewSnapshot {
    /**
     * The number of seconds that this call has been ongoing for.
     */
    duration: number;
}

export type DurationViewModel = ViewModel<DurationViewSnapshot>;

interface Props {
    vm: DurationViewModel;

    /**
     * Additional class names for this component.
     */
    classNames?: string;
}

/**
 * View to show the duration of the call.
 */
export function DurationView(props: Props): React.ReactNode {
    const { duration } = useViewModel(props.vm);
    const classes = classNames(styles.container, props.classNames);

    return (
        <div className={classes}>
            (<Clock seconds={duration} minutesMaxLength={1} className={classes} />)
        </div>
    );
}
