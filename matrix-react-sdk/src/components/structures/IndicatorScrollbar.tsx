/*
Copyright 2018 New Vector Ltd

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

import React, { createRef } from "react";

import AutoHideScrollbar, { IProps as AutoHideScrollbarProps } from "./AutoHideScrollbar";
import UIStore, { UI_EVENTS } from "../../stores/UIStore";

export type IProps<T extends keyof JSX.IntrinsicElements> = Omit<AutoHideScrollbarProps<T>, "onWheel" | "element"> & {
    element?: T;
    // If true, the scrollbar will append mx_IndicatorScrollbar_leftOverflowIndicator
    // and mx_IndicatorScrollbar_rightOverflowIndicator elements to the list for positioning
    // by the parent element.
    trackHorizontalOverflow?: boolean;

    // If true, when the user tries to use their mouse wheel in the component it will
    // scroll horizontally rather than vertically. This should only be used on components
    // with no vertical scroll opportunity.
    verticalScrollsHorizontally?: boolean;

    children: React.ReactNode;
};

interface IState {
    leftIndicatorOffset: string;
    rightIndicatorOffset: string;
}

export default class IndicatorScrollbar<T extends keyof JSX.IntrinsicElements> extends React.Component<
    IProps<T>,
    IState
> {
    private autoHideScrollbar = createRef<AutoHideScrollbar<any>>();
    private scrollElement?: HTMLDivElement;
    private likelyTrackpadUser: boolean | null = null;
    private checkAgainForTrackpad = 0; // ts in milliseconds to recheck this._likelyTrackpadUser

    public constructor(props: IProps<T>) {
        super(props);

        this.state = {
            leftIndicatorOffset: "0",
            rightIndicatorOffset: "0",
        };
    }

    private collectScroller = (scroller: HTMLDivElement): void => {
        this.props.wrappedRef?.(scroller);
        if (scroller && !this.scrollElement) {
            this.scrollElement = scroller;
            // Using the passive option to not block the main thread
            // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#improving_scrolling_performance_with_passive_listeners
            this.scrollElement.addEventListener("scroll", this.checkOverflow, { passive: true });
            this.checkOverflow();
        }
    };

    public componentDidUpdate(prevProps: IProps<T>): void {
        const prevLen = React.Children.count(prevProps.children);
        const curLen = React.Children.count(this.props.children);
        // check overflow only if amount of children changes.
        // if we don't guard here, we end up with an infinite
        // render > componentDidUpdate > checkOverflow > setState > render loop
        if (prevLen !== curLen) {
            this.checkOverflow();
        }
    }

    public componentDidMount(): void {
        this.checkOverflow();
        UIStore.instance.on(UI_EVENTS.Resize, this.checkOverflow);
    }

    private checkOverflow = (): void => {
        if (!this.scrollElement) return;
        const hasTopOverflow = this.scrollElement.scrollTop > 0;
        const hasBottomOverflow =
            this.scrollElement.scrollHeight > this.scrollElement.scrollTop + this.scrollElement.clientHeight;
        const hasLeftOverflow = this.scrollElement.scrollLeft > 0;
        const hasRightOverflow =
            this.scrollElement.scrollWidth > this.scrollElement.scrollLeft + this.scrollElement.clientWidth;

        if (hasTopOverflow) {
            this.scrollElement.classList.add("mx_IndicatorScrollbar_topOverflow");
        } else {
            this.scrollElement.classList.remove("mx_IndicatorScrollbar_topOverflow");
        }
        if (hasBottomOverflow) {
            this.scrollElement.classList.add("mx_IndicatorScrollbar_bottomOverflow");
        } else {
            this.scrollElement.classList.remove("mx_IndicatorScrollbar_bottomOverflow");
        }
        if (hasLeftOverflow) {
            this.scrollElement.classList.add("mx_IndicatorScrollbar_leftOverflow");
        } else {
            this.scrollElement.classList.remove("mx_IndicatorScrollbar_leftOverflow");
        }
        if (hasRightOverflow) {
            this.scrollElement.classList.add("mx_IndicatorScrollbar_rightOverflow");
        } else {
            this.scrollElement.classList.remove("mx_IndicatorScrollbar_rightOverflow");
        }

        if (this.props.trackHorizontalOverflow) {
            this.setState({
                // Offset from absolute position of the container
                leftIndicatorOffset: hasLeftOverflow ? `${this.scrollElement.scrollLeft}px` : "0",

                // Negative because we're coming from the right
                rightIndicatorOffset: hasRightOverflow ? `-${this.scrollElement.scrollLeft}px` : "0",
            });
        }
    };

    public componentWillUnmount(): void {
        this.scrollElement?.removeEventListener("scroll", this.checkOverflow);
        UIStore.instance.off(UI_EVENTS.Resize, this.checkOverflow);
    }

    private onMouseWheel = (e: React.WheelEvent): void => {
        if (this.props.verticalScrollsHorizontally && this.scrollElement) {
            // xyThreshold is the amount of horizontal motion required for the component to
            // ignore the vertical delta in a scroll. Used to stop trackpads from acting in
            // strange ways. Should be positive.
            const xyThreshold = 0;

            // yRetention is the factor multiplied by the vertical delta to try and reduce
            // the harshness of the scroll behaviour. Should be a value between 0 and 1.
            const yRetention = 1.0;

            // whenever we see horizontal scrolling, assume the user is on a trackpad
            // for at least the next 1 minute.
            const now = new Date().getTime();
            if (Math.abs(e.deltaX) > 0) {
                this.likelyTrackpadUser = true;
                this.checkAgainForTrackpad = now + 1 * 60 * 1000;
            } else {
                // if we haven't seen any horizontal scrolling for a while, assume
                // the user might have plugged in a mousewheel
                if (this.likelyTrackpadUser && now >= this.checkAgainForTrackpad) {
                    this.likelyTrackpadUser = false;
                }
            }

            // don't mess with the horizontal scroll for trackpad users
            // See https://github.com/vector-im/element-web/issues/10005
            if (this.likelyTrackpadUser) {
                return;
            }

            if (Math.abs(e.deltaX) <= xyThreshold) {
                // we are vertically scrolling.
                // HACK: We increase the amount of scroll to counteract smooth scrolling browsers.
                // Smooth scrolling browsers (Firefox) use the relative area to determine the scroll
                // amount, which means the likely small area of content results in a small amount of
                // movement - not what people expect. We pick arbitrary values for when to apply more
                // scroll, and how much to apply. On Windows 10, Chrome scrolls 100 units whereas
                // Firefox scrolls just 3 due to smooth scrolling.

                const additionalScroll = e.deltaY < 0 ? -50 : 50;

                // noinspection JSSuspiciousNameCombination
                const val = Math.abs(e.deltaY) < 25 ? e.deltaY + additionalScroll : e.deltaY;
                this.scrollElement.scrollLeft += val * yRetention;
            }
        }
    };

    public render(): React.ReactNode {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { children, trackHorizontalOverflow, verticalScrollsHorizontally, ...otherProps } = this.props;

        const leftIndicatorStyle = { left: this.state.leftIndicatorOffset };
        const rightIndicatorStyle = { right: this.state.rightIndicatorOffset };
        const leftOverflowIndicator = trackHorizontalOverflow ? (
            <div className="mx_IndicatorScrollbar_leftOverflowIndicator" style={leftIndicatorStyle} />
        ) : null;
        const rightOverflowIndicator = trackHorizontalOverflow ? (
            <div className="mx_IndicatorScrollbar_rightOverflowIndicator" style={rightIndicatorStyle} />
        ) : null;

        return (
            <AutoHideScrollbar
                {...otherProps}
                ref={this.autoHideScrollbar}
                wrappedRef={this.collectScroller}
                onWheel={this.onMouseWheel}
            >
                {leftOverflowIndicator}
                {children}
                {rightOverflowIndicator}
            </AutoHideScrollbar>
        );
    }
}
