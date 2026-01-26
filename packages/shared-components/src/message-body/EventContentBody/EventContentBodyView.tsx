/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode, type Ref } from "react";

import { type ViewModel, useViewModel } from "../../viewmodel";

/**
 * Snapshot interface for the EventContentBody view.
 */
export interface EventContentBodyViewSnapshot {
    /**
     * The rendered content to display.
     * This is pre-processed HTML/JSX with pills, spoilers, code blocks, etc.
     */
    children: ReactNode;
    /**
     * CSS class names to apply to the container element.
     * Includes classes like mx_EventTile_body, mx_EventTile_bigEmoji, markdown-body, etc.
     */
    className: string;
    /**
     * The text direction attribute.
     * Always "auto" for divs, controlled by includeDir prop for spans.
     */
    dir?: "auto";
}

export type EventContentBodyViewModel = ViewModel<EventContentBodyViewSnapshot>;

export interface EventContentBodyViewProps {
    /**
     * The ViewModel providing the snapshot data.
     */
    vm: EventContentBodyViewModel;
    /**
     * Whether to render the content in a div or span.
     */
    as: "span" | "div";
    /**
     * Optional ref to forward to the rendered element.
     */
    ref?: Ref<HTMLElement>;
}

/**
 * View component for rendering Matrix event content body.
 * This is a "dumb" component that only renders based on the snapshot data.
 * All Matrix SDK interactions and content processing happen in the ViewModel.
 */
export function EventContentBodyView({ vm, as, ref }: Readonly<EventContentBodyViewProps>): JSX.Element {
    const snapshot = useViewModel(vm);
    const { children, className, dir } = snapshot;

    const As = as;

    return (
        <As ref={ref as any} className={className} dir={dir}>
            {children}
        </As>
    );
}
