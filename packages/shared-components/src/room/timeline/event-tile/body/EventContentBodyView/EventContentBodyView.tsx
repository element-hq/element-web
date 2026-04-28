/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, memo, type Ref } from "react";
import parse, { type HTMLReactParserOptions } from "html-react-parser";

import { type ViewModel, useViewModel } from "../../../../../core/viewmodel";
import { applyReplacerOnString } from "../../../../../core/utils/applyReplacerOnString";

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
     */
    className: string;
    /**
     * The text direction attribute.
     * Always "auto" for divs, controlled by includeDir prop for spans.
     */
    dir?: "auto";
}

export type EventContentBodyViewModel = ViewModel<EventContentBodyViewSnapshot>;

interface EventContentBodyBaseViewProps {
    /**
     * The ViewModel providing the snapshot data.
     */
    vm: EventContentBodyViewModel;
}

export type EventContentBodyViewProps = EventContentBodyBaseViewProps &
    (
        | {
              /**
               * Render the content in a span element.
               */
              as: "span";
              /**
               * Optional ref to forward to the rendered span element.
               */
              ref?: Ref<HTMLSpanElement>;
          }
        | {
              /**
               * Render the content in a div element.
               */
              as: "div";
              /**
               * Optional ref to forward to the rendered div element.
               */
              ref?: Ref<HTMLDivElement>;
          }
    );

/**
 * View component for rendering Matrix event content body.
 */
export const EventContentBodyView = memo(function EventContentBodyView({
    vm,
    as,
    ref,
}: Readonly<EventContentBodyViewProps>): JSX.Element {
    const { body, formattedBody, replacer, className, dir, parseFormattedBody } = useViewModel(vm);
    const parseBody =
        parseFormattedBody ??
        ((formatted: string, inputReplacer?: Replacer) =>
            parse(formatted, inputReplacer ? { replace: inputReplacer } : undefined));
    const children = formattedBody ? parseBody(formattedBody, replacer) : applyReplacerOnString(body, replacer);

    if (as === "span") {
        return (
            <span ref={ref} className={className} dir={dir}>
                {children}
            </span>
        );
    }

    return (
        <div ref={ref} className={className} dir={dir}>
            {children}
        </div>
    );
});
