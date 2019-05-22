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
    static PropTypes = {
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

        if (this._autoHideScrollbar) {
            this._autoHideScrollbar.checkOverflow();
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

            if (Math.abs(e.deltaX) <= xyThreshold) {
                // noinspection JSSuspiciousNameCombination
                this._scrollElement.scrollLeft += e.deltaY * yRetention;
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
            {... this.props}
        >
            { leftOverflowIndicator }
            { this.props.children }
            { rightOverflowIndicator }
        </AutoHideScrollbar>);
    }
}
