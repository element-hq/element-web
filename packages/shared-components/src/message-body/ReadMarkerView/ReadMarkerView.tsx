/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type RefCallback, type TransitionEventHandler } from "react";
import classNames from "classnames";

import { type ViewModel, useViewModel } from "../../viewmodel";
import styles from "./ReadMarkerView.module.css";

export type ReadMarkerKind = "current" | "ghost";

export interface ReadMarkerViewSnapshot {
    /**
     * The event ID this marker is associated with.
     */
    eventId: string;
    /**
     * Whether this is the active read marker or a ghost marker transitioning out.
     */
    kind: ReadMarkerKind;
    /**
     * Whether the visible line should be rendered for the active marker.
     * Hidden active markers still render the host `<li>` to preserve layout calculations.
     */
    showLine?: boolean;
}

export interface ReadMarkerViewActions {
    /**
     * Ref callback for the active read marker `<li>`.
     */
    onCurrentMarkerRef?: RefCallback<HTMLLIElement>;
    /**
     * Ref callback for the ghost marker `<hr>`.
     */
    onGhostLineRef?: RefCallback<HTMLHRElement>;
    /**
     * Transition-end handler for the ghost marker `<hr>`.
     */
    onGhostTransitionEnd?: TransitionEventHandler<HTMLHRElement>;
}

export type ReadMarkerViewModel = ViewModel<ReadMarkerViewSnapshot, ReadMarkerViewActions>;

interface ReadMarkerViewProps {
    vm: ReadMarkerViewModel;
    /**
     * Optional CSS className for the outer list item.
     */
    className?: string;
}

export function ReadMarkerView({ vm, className }: Readonly<ReadMarkerViewProps>): JSX.Element {
    const { eventId, kind, showLine = true } = useViewModel(vm);

    const line =
        kind === "ghost" ? (
            <hr
                className={styles.line}
                ref={vm.onGhostLineRef}
                onTransitionEnd={vm.onGhostTransitionEnd}
                data-eventid={eventId}
            />
        ) : showLine ? (
            <hr className={styles.line} />
        ) : null;

    return (
        <li
            className={classNames(className, styles.readMarker)}
            ref={kind === "current" ? vm.onCurrentMarkerRef : undefined}
            data-scroll-tokens={kind === "current" ? eventId : undefined}
        >
            {line}
        </li>
    );
}
