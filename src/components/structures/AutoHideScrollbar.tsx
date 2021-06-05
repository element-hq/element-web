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

import React from "react";

interface IProps {
    className?: string;
    onScroll?: () => void;
    onWheel?: () => void;
    style?: React.CSSProperties
    tabIndex?: number,
    wrappedRef?: (ref: HTMLDivElement) => void;
}

export default class AutoHideScrollbar extends React.Component<IProps> {
    private containerRef: React.RefObject<HTMLDivElement> = React.createRef();

    public componentDidMount() {
        if (this.containerRef.current && this.props.onScroll) {
            // Using the passive option to not block the main thread
            // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#improving_scrolling_performance_with_passive_listeners
            this.containerRef.current.addEventListener("scroll", this.props.onScroll, { passive: true });
        }

        if (this.props.wrappedRef) {
            this.props.wrappedRef(this.containerRef.current);
        }
    }

    public componentWillUnmount() {
        if (this.containerRef.current && this.props.onScroll) {
            this.containerRef.current.removeEventListener("scroll", this.props.onScroll);
        }
    }

    public getScrollTop(): number {
        return this.containerRef.current.scrollTop;
    }

    public render() {
        return (<div
            ref={this.containerRef}
            style={this.props.style}
            className={["mx_AutoHideScrollbar", this.props.className].join(" ")}
            onWheel={this.props.onWheel}
            tabIndex={this.props.tabIndex}
        >
            { this.props.children }
        </div>);
    }
}
