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

import React from "react";
import PropTypes from "prop-types";
import AutoHideScrollbar from "./AutoHideScrollbar";

export default class IndicatorScrollbar extends React.Component {
    static propTypes = {
        // If true, the scrollbar will append mx_IndicatorScrollbar_leftOverflowIndicator
        // and mx_IndicatorScrollbar_rightOverflowIndicator elements to the list for positioning
        // by the parent element.
        trackHorizontalOverflow: PropTypes.bool,

        // If true, when the user tries to use their mouse wheel in the component it will
        // scroll horizontally rather than vertically. This should only be used on components
        // with no vertical scroll opportunity.
        verticalScrollsHorizontally: PropTypes.bool,
    };

    constructor(props) {
        super(props);
        this._collectScroller = this._collectScroller.bind(this);
        this._collectScrollerComponent = this._collectScrollerComponent.bind(this);
        this.checkOverflow = this.checkOverflow.bind(this);
        this._scrollElement = null;
        this._autoHideScrollbar = null;
        this._likelyTrackpadUser = null;
        this._checkAgainForTrackpad = 0; // ts in milliseconds to recheck this._likelyTrackpadUser

        this.state = {
            leftIndicatorOffset: 0,
            rightIndicatorOffset: 0,
        };
    }

    moveToOrigin() {
        if (!this._scrollElement) return;

        this._scrollElement.scrollLeft = 0;
        this._scrollElement.scrollTop = 0;
    }

    _collectScroller(scroller) {
        if (scroller && !this._scrollElement) {
            this._scrollElement = scroller;
            this._scrollElement.addEventListener("scroll", this.checkOverflow);
            this.checkOverflow();
        }
    }

    _collectScrollerComponent(autoHideScrollbar) {
        this._autoHideScrollbar = autoHideScrollbar;
    }


    componentDidUpdate(prevProps) {
        const prevLen = prevProps && prevProps.children && prevProps.children.length || 0;
        const curLen = this.props.children && this.props.children.length || 0;
        // check overflow only if amount of children changes.
        // if we don't guard here, we end up with an infinite
        // render > componentDidUpdate > checkOverflow > setState > render loop
        if (prevLen !== curLen) {
            this.checkOverflow();
        }
    }

    componentDidMount() {
        this.checkOverflow();
    }

    checkOverflow() {
        const hasTopOverflow = this._scrollElement.scrollTop > 0;
        const hasBottomOverflow = this._scrollElement.scrollHeight >
            (this._scrollElement.scrollTop + this._scrollElement.clientHeight);
        const hasLeftOverflow = this._scrollElement.scrollLeft > 0;
        const hasRightOverflow = this._scrollElement.scrollWidth >
            (this._scrollElement.scrollLeft + this._scrollElement.clientWidth);

        if (hasTopOverflow) {
            this._scrollElement.classList.add("mx_IndicatorScrollbar_topOverflow");
        } else {
            this._scrollElement.classList.remove("mx_IndicatorScrollbar_topOverflow");
        }
        if (hasBottomOverflow) {
            this._scrollElement.classList.add("mx_IndicatorScrollbar_bottomOverflow");
        } else {
            this._scrollElement.classList.remove("mx_IndicatorScrollbar_bottomOverflow");
        }
        if (hasLeftOverflow) {
            this._scrollElement.classList.add("mx_IndicatorScrollbar_leftOverflow");
        } else {
            this._scrollElement.classList.remove("mx_IndicatorScrollbar_leftOverflow");
        }
        if (hasRightOverflow) {
            this._scrollElement.classList.add("mx_IndicatorScrollbar_rightOverflow");
        } else {
            this._scrollElement.classList.remove("mx_IndicatorScrollbar_rightOverflow");
        }

        if (this.props.trackHorizontalOverflow) {
            this.setState({
                // Offset from absolute position of the container
                leftIndicatorOffset: hasLeftOverflow ? `${this._scrollElement.scrollLeft}px` : '0',

                // Negative because we're coming from the right
                rightIndicatorOffset: hasRightOverflow ? `-${this._scrollElement.scrollLeft}px` : '0',
            });
        }
    }

    getScrollTop() {
        return this._autoHideScrollbar.getScrollTop();
    }

    componentWillUnmount() {
        if (this._scrollElement) {
            this._scrollElement.removeEventListener("scroll", this.checkOverflow);
        }
    }

    onMouseWheel = (e) => {
        if (this.props.verticalScrollsHorizontally && this._scrollElement) {
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
                this._likelyTrackpadUser = true;
                this._checkAgainForTrackpad = now + (1 * 60 * 1000);
            } else {
                // if we haven't seen any horizontal scrolling for a while, assume
                // the user might have plugged in a mousewheel
                if (this._likelyTrackpadUser && now >= this._checkAgainForTrackpad) {
                    this._likelyTrackpadUser = false;
                }
            }

            // don't mess with the horizontal scroll for trackpad users
            // See https://github.com/vector-im/riot-web/issues/10005
            if (this._likelyTrackpadUser) {
                return;
            }

            if (Math.abs(e.deltaX) <= xyThreshold) { // we are vertically scrolling.
                // HACK: We increase the amount of scroll to counteract smooth scrolling browsers.
                // Smooth scrolling browsers (Firefox) use the relative area to determine the scroll
                // amount, which means the likely small area of content results in a small amount of
                // movement - not what people expect. We pick arbitrary values for when to apply more
                // scroll, and how much to apply. On Windows 10, Chrome scrolls 100 units whereas
                // Firefox scrolls just 3 due to smooth scrolling.

                const additionalScroll = e.deltaY < 0 ? -50 : 50;

                // noinspection JSSuspiciousNameCombination
                const val = Math.abs(e.deltaY) < 25 ? (e.deltaY + additionalScroll) : e.deltaY;
                this._scrollElement.scrollLeft += val * yRetention;
            }
        }
    };

    render() {
        const leftIndicatorStyle = {left: this.state.leftIndicatorOffset};
        const rightIndicatorStyle = {right: this.state.rightIndicatorOffset};
        const leftOverflowIndicator = this.props.trackHorizontalOverflow
            ? <div className="mx_IndicatorScrollbar_leftOverflowIndicator" style={leftIndicatorStyle} /> : null;
        const rightOverflowIndicator = this.props.trackHorizontalOverflow
            ? <div className="mx_IndicatorScrollbar_rightOverflowIndicator" style={rightIndicatorStyle} /> : null;

        return (<AutoHideScrollbar
            ref={this._collectScrollerComponent}
            wrappedRef={this._collectScroller}
            onWheel={this.onMouseWheel}
            {...this.props}
        >
            { leftOverflowIndicator }
            { this.props.children }
            { rightOverflowIndicator }
        </AutoHideScrollbar>);
    }
}
