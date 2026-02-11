/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type Ref } from "react";
import parse, { type HTMLReactParserOptions } from "html-react-parser";

import { type ViewModel, useViewModel } from "../../viewmodel";
import { applyReplacerOnString } from "../../utils/applyReplacerOnString";

type Replacer = HTMLReactParserOptions["replace"];
type ParseFormattedBody = (formattedBody: string, replacer?: Replacer) => ReturnType<typeof parse>;

/**
 * Snapshot interface for the EventContentBody view.
 */
export interface EventContentBodyViewSnapshot {
    /**
     * The plain/emoji body content to render when no formatted body is available.
     */
    body: string | JSX.Element[];
    /**
     * The raw formatted body HTML, if available.
     */
    formattedBody?: string;
    /**
     * The text/element replacer used for pills, spoilers, code blocks, etc.
     */
    replacer?: Replacer;
    /**
     * Optional parser implementation for formatted bodies.
     * This allows callers to provide a parser that matches their replacer implementation.
     */
    parseFormattedBody?: ParseFormattedBody;
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
    const { body, formattedBody, replacer, className, dir, parseFormattedBody } = snapshot;

    const As = as;
    const parseBody =
        parseFormattedBody ??
        ((formatted: string, inputReplacer?: Replacer) =>
            parse(formatted, inputReplacer ? { replace: inputReplacer } : undefined));
    const children = formattedBody
        ? parseBody(formattedBody, replacer)
        : applyReplacerOnString(body, replacer);

    return (
        <As ref={ref as any} className={className} dir={dir}>
            {children}
        </As>
    );
}
