/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Virtuoso } from "react-virtuoso";
import classNames from "classnames";

import { useTimelineViewPresenter } from "./TimelineViewPresenter";
import styles from "./TimelineView.module.css";
import type { TimelineItem, TimelineViewProps } from "./types";

/**
 * Renders a virtualized room timeline backed by a {@link TimelineViewModel}.
 *
 * The component owns the mechanics of timeline scrolling so feature code can
 * focus on producing a snapshot and rendering rows. It preserves the viewport
 * across pagination, follows the live edge when appropriate, and executes
 * one-shot anchor jumps exposed through the view model.
 *
 * Consumers provide the row renderer through {@link TimelineViewProps.renderItem}
 * and update the timeline state through the view-model callbacks declared by
 * {@link TimelineViewActions}. The rendered list is powered by `react-virtuoso`
 * to keep large timelines responsive while only mounting the visible window.
 *
 * @typeParam TItem - Concrete timeline item shape rendered by the timeline.
 */
export function TimelineView<TItem extends TimelineItem>({
    vm,
    className,
    renderItem,
}: Readonly<TimelineViewProps<TItem>>): JSX.Element {
    const { items, virtuosoProps, itemContent, handleScrollerRef } = useTimelineViewPresenter({
        vm,
        renderItem,
    });

    return (
        <Virtuoso
            className={classNames(styles.timeline, className)}
            data={items}
            itemContent={itemContent}
            {...virtuosoProps}
            scrollerRef={handleScrollerRef}
        />
    );
}
