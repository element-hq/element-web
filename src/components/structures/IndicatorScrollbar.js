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
import AutoHideScrollbar from "./AutoHideScrollbar";

export default class IndicatorScrollbar extends React.Component {
    constructor(props) {
        super(props);
        this._collectScroller = this._collectScroller.bind(this);
        this._collectScrollerComponent = this._collectScrollerComponent.bind(this);
        this.checkOverflow = this.checkOverflow.bind(this);
        this._scrollElement = null;
        this._autoHideScrollbar = null;
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

        if (this._autoHideScrollbar) {
            this._autoHideScrollbar.checkOverflow();
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

    render() {
        return (<AutoHideScrollbar
            ref={this._collectScrollerComponent}
            wrappedRef={this._collectScroller}
            {... this.props}
        >
            { this.props.children }
        </AutoHideScrollbar>);
    }
}
