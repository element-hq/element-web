/*
Copyright 2018 New Vector Ltd
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import classNames from "classnames";
import React, { HTMLAttributes, ReactHTML, ReactNode, WheelEvent } from "react";

type DynamicHtmlElementProps<T extends keyof JSX.IntrinsicElements> =
    JSX.IntrinsicElements[T] extends HTMLAttributes<{}> ? DynamicElementProps<T> : DynamicElementProps<"div">;
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
