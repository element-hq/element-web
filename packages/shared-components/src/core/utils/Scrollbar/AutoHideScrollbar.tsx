/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type HTMLAttributes, type JSX, type ReactNode, type WheelEvent } from "react";

import styles from "./AutoHideScrollbar.module.css";

type DynamicHtmlElementProps<T extends keyof JSX.IntrinsicElements> =
    JSX.IntrinsicElements[T] extends HTMLAttributes<object> ? DynamicElementProps<T> : DynamicElementProps<"div">;
type DynamicElementProps<T extends keyof JSX.IntrinsicElements> = Partial<Omit<JSX.IntrinsicElements[T], "ref">>;

/**
 * Props for `AutoHideScrollbar`.
 */
export type AutoHideScrollbarProps<T extends keyof JSX.IntrinsicElements = "div"> = Omit<
    DynamicHtmlElementProps<T>,
    "onScroll"
> & {
    /** Element tag to render. */
    element?: T;
    /** Additional class names to append to the scrollbar root. */
    className?: string;
    /** Native scroll handler attached with a passive listener. */
    onScroll?: (event: Event) => void;
    /** Optional wheel handler forwarded to the root element. */
    onWheel?: (event: WheelEvent) => void;
    /** Inline styles applied to the root element. */
    style?: React.CSSProperties;
    /** Tab index override; defaults to `-1`. */
    tabIndex?: number;
    /** Receives the mounted scroll container element. */
    wrappedRef?: (ref: HTMLDivElement | null) => void;
    /** Scrollable content rendered inside the container. */
    children: ReactNode;
};

/**
 * Scroll container that hides native scrollbars until hovered.
 */
export function AutoHideScrollbar<T extends keyof JSX.IntrinsicElements = "div">(
    props: AutoHideScrollbarProps<T>,
): React.ReactNode {
    const { element = "div" as T, className, onScroll, tabIndex, wrappedRef, children, ...otherProps } = props;
    const [container, setContainer] = React.useState<HTMLDivElement | null>(null);

    React.useEffect(() => {
        if (!container || !onScroll) {
            return;
        }

        // Using the passive option to not block the main thread.
        // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#improving_scrolling_performance_with_passive_listeners
        container.addEventListener("scroll", onScroll, { passive: true });

        return (): void => {
            container.removeEventListener("scroll", onScroll);
        };
    }, [container, onScroll]);

    React.useEffect(() => {
        wrappedRef?.(container);

        return (): void => {
            wrappedRef?.(null);
        };
    }, [container, wrappedRef]);

    return React.createElement(
        element,
        {
            ...otherProps,
            ref: setContainer,
            className: classNames(styles.scrollbar, className),
            // Firefox sometimes makes this element focusable due to
            // overflow:scroll;, so force it out of tab order by default.
            tabIndex: tabIndex ?? -1,
        },
        children,
    );
}
