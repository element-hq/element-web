/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type RefCallback, type TransitionEventHandler } from "react";
import classNames from "classnames";

import styles from "./ReadMarker.module.css";

export type ReadMarkerKind = "current" | "ghost";

export interface ReadMarkerProps {
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
    /**
     * Optional CSS className for the outer list item.
     */
    className?: string;
}

export function ReadMarker({
    eventId,
    kind,
    showLine = true,
    onCurrentMarkerRef,
    onGhostLineRef,
    onGhostTransitionEnd,
    className,
}: Readonly<ReadMarkerProps>): JSX.Element {
    const line =
        kind === "ghost" ? (
            <hr
                className={styles.line}
                ref={onGhostLineRef}
                onTransitionEnd={onGhostTransitionEnd}
                data-eventid={eventId}
            />
        ) : showLine ? (
            <hr className={styles.line} />
        ) : null;

    return (
        <li
            className={classNames(className, styles.readMarker)}
            ref={kind === "current" ? onCurrentMarkerRef : undefined}
            data-scroll-tokens={kind === "current" ? eventId : undefined}
        >
            {line}
        </li>
    );
}
