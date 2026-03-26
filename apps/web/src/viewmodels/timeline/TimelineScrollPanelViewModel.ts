/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { BaseViewModel } from "@element-hq/web-shared-components";

import { type IScrollState } from "../../components/structures/ScrollPanel";

export interface TimelineVisibleRange {
    startIndex: number;
    endIndex: number;
}

export interface TimelineScrollPanelViewModelProps {
    initialIsAtBottom?: boolean;
    initialScrollState?: IScrollState;
    initialHasScrollContainer?: boolean;
    initialVisibleRange?: TimelineVisibleRange | null;
}

export interface TimelineScrollPanelViewSnapshot {
    isAtBottom: boolean;
    scrollState: IScrollState;
    hasScrollContainer: boolean;
    visibleRange: TimelineVisibleRange | null;
}

export class TimelineScrollPanelViewModel extends BaseViewModel<
    TimelineScrollPanelViewSnapshot,
    TimelineScrollPanelViewModelProps
> {
    public constructor(props: TimelineScrollPanelViewModelProps = {}) {
        super(props, {
            isAtBottom: props.initialIsAtBottom ?? false,
            scrollState: props.initialScrollState ?? {},
            hasScrollContainer: props.initialHasScrollContainer ?? false,
            visibleRange: props.initialVisibleRange ?? null,
        });
    }

    public sync({
        isAtBottom,
        scrollState,
        hasScrollContainer,
        visibleRange,
    }: Partial<TimelineScrollPanelViewSnapshot>): void {
        const current = this.snapshot.current;
        this.snapshot.set({
            isAtBottom: isAtBottom ?? current.isAtBottom,
            scrollState: scrollState ?? current.scrollState,
            hasScrollContainer: hasScrollContainer ?? current.hasScrollContainer,
            visibleRange: visibleRange ?? current.visibleRange,
        });
    }
}
