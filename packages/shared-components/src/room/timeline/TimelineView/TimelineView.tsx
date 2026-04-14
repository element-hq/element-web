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
