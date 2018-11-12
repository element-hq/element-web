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
        this.checkOverflow = this.checkOverflow.bind(this);
    }

    _collectScroller(scroller) {
        if (scroller && !this._scroller) {
            this._scroller = scroller;
            this._scroller.addEventListener("scroll", this.checkOverflow);
            this.checkOverflow();
        }
    }

    checkOverflow() {
        const hasTopOverflow = this._scroller.scrollTop > 0;
        const hasBottomOverflow = this._scroller.scrollHeight >
            (this._scroller.scrollTop + this._scroller.clientHeight);
        if (hasTopOverflow) {
            this._scroller.classList.add("mx_IndicatorScrollbar_topOverflow");
        } else {
            this._scroller.classList.remove("mx_IndicatorScrollbar_topOverflow");
        }
        if (hasBottomOverflow) {
            this._scroller.classList.add("mx_IndicatorScrollbar_bottomOverflow");
        } else {
            this._scroller.classList.remove("mx_IndicatorScrollbar_bottomOverflow");
        }
    }

    componentWillUnmount() {
        if (this._scroller) {
            this._scroller.removeEventListener("scroll", this.checkOverflow);
        }
    }

    render() {
        return (<AutoHideScrollbar wrappedRef={this._collectScroller} {... this.props}>
            { this.props.children }
        </AutoHideScrollbar>);
    }
}
