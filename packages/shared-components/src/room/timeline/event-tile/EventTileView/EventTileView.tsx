/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";

import type { EventTileViewProps } from "./EventTileView.types";
import styles from "./EventTileView.module.css";

/**
 * Renders the common EventTile root and event-line structure.
 *
 * Timeline-specific slot placement is added by the rendering-mode branches in
 * subsequent migration steps. The application supplies render-ready content;
 * this component owns only the shared structure and root behavior.
 */
export function EventTileView({
    root,
    line,
    slots,
    refs,
    as: Root = "li",
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onClick,
    onContextMenu,
}: Readonly<EventTileViewProps>): JSX.Element {
    return (
        <Root
            ref={refs?.root}
            className={classNames(styles.root, root.className)}
            aria-live={root.ariaLive}
            aria-atomic={true}
            data-scroll-tokens={root.scrollToken}
            data-event-id={root.data.eventId}
            data-layout={root.data.layout}
            data-shape={root.data.shape}
            data-self={root.data.isOwnEvent}
            data-has-reply={root.data.hasReply}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onFocus={onFocus}
            onBlur={onBlur}
            onClick={onClick}
        >
            <div id={line.id} className={classNames(styles.line, line.className)} onContextMenu={onContextMenu}>
                {slots.contextMenu}
                {slots.body}
            </div>
        </Root>
    );
}
