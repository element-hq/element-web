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
     * Text shown at the right-hand end of the line, e.g. "New".
     *
     * A labelled marker takes up space, unlike the plain line, so give it a row of its
     * own rather than sitting it between two messages. Ignored while the marker is
     * fading out, which animates the line in a way a label could not follow.
     */
    label?: string;
    /**
     * Element to render as. Pass `"div"` if the caller already puts each row in its own
     * list item, since a list item cannot contain another one.
     * @default "li"
     */
    as?: "li" | "div";
    /**
     * Ref callback for the active read marker's host element.
     */
    onCurrentMarkerRef?: RefCallback<HTMLElement>;
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
    label,
    as: Host = "li",
    onCurrentMarkerRef,
    onGhostLineRef,
    onGhostTransitionEnd,
    className,
}: Readonly<ReadMarkerProps>): JSX.Element {
    // A label only makes sense once the marker has settled, not while it fades out.
    const labelled = kind === "current" && showLine && label !== undefined;
    let line: JSX.Element | null = null;

    if (kind === "ghost") {
        line = (
            <hr
                className={styles.line}
                ref={onGhostLineRef}
                onTransitionEnd={onGhostTransitionEnd}
                data-eventid={eventId}
            />
        );
    } else if (labelled) {
        // The line is this box's bottom border, so the text sits on top of it at the
        // right-hand end, rather than breaking it in two like a date separator does.
        line = (
            <div className={styles.labelledLine} role="separator" aria-label={label}>
                <span className={styles.label}>{label}</span>
            </div>
        );
    } else if (showLine) {
        line = <hr className={styles.line} />;
    }

    return (
        <Host
            className={classNames(className, styles.readMarker, { [styles.labelledMarker]: labelled })}
            ref={kind === "current" ? onCurrentMarkerRef : undefined}
            data-scroll-tokens={kind === "current" ? eventId : undefined}
        >
            {line}
        </Host>
    );
}
