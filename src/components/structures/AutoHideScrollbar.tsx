/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { type HTMLAttributes, type ReactHTML, type ReactNode, type WheelEvent } from "react";

type DynamicHtmlElementProps<T extends keyof JSX.IntrinsicElements> =
    JSX.IntrinsicElements[T] extends HTMLAttributes<object> ? DynamicElementProps<T> : DynamicElementProps<"div">;
type DynamicElementProps<T extends keyof JSX.IntrinsicElements> = Partial<Omit<JSX.IntrinsicElements[T], "ref">>;

export type IProps<T extends keyof JSX.IntrinsicElements> = Omit<DynamicHtmlElementProps<T>, "onScroll"> & {
    element: T;
    className?: string;
    onScroll?: (event: Event) => void;
    onWheel?: (event: WheelEvent) => void;
    style?: React.CSSProperties;
    tabIndex?: number;
    wrappedRef?: (ref: HTMLDivElement | null) => void;
    children: ReactNode;
};

export default class AutoHideScrollbar<T extends keyof JSX.IntrinsicElements> extends React.Component<IProps<T>> {
    public static defaultProps = {
        element: "div" as keyof ReactHTML,
    };

    public readonly containerRef: React.RefObject<HTMLDivElement> = React.createRef();

    public componentDidMount(): void {
        if (this.containerRef.current && this.props.onScroll) {
            // Using the passive option to not block the main thread
            // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#improving_scrolling_performance_with_passive_listeners
            this.containerRef.current.addEventListener("scroll", this.props.onScroll, { passive: true });
        }

        this.props.wrappedRef?.(this.containerRef.current);
    }

    public componentWillUnmount(): void {
        if (this.containerRef.current && this.props.onScroll) {
            this.containerRef.current.removeEventListener("scroll", this.props.onScroll);
        }

        this.props.wrappedRef?.(null);
    }

    public render(): React.ReactNode {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { element, className, onScroll, tabIndex, wrappedRef, children, ...otherProps } = this.props;

        return React.createElement(
            element,
            {
                ...otherProps,
                ref: this.containerRef,
                className: classNames("mx_AutoHideScrollbar", className),
                // Firefox sometimes makes this element focusable due to
                // overflow:scroll;, so force it out of tab order by default.
                tabIndex: tabIndex ?? -1,
            },
            children,
        );
    }
}
