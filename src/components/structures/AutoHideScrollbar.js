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

// derived from code from github.com/noeldelgado/gemini-scrollbar
// Copyright (c) Noel Delgado <pixelia.me@gmail.com> (pixelia.me)
function getScrollbarWidth(alternativeOverflow) {
    var e = document.createElement('div'), sw;
    e.style.position = 'absolute';
    e.style.top = '-9999px';
    e.style.width = '100px';
    e.style.height = '100px';
    e.style.overflow = "scroll";
    if (alternativeOverflow) {
        e.style.overflow = alternativeOverflow;
    }
    e.style.msOverflowStyle = '-ms-autohiding-scrollbar';
    document.body.appendChild(e);
    sw = (e.offsetWidth - e.clientWidth);
    document.body.removeChild(e);
    return sw;
}

function install() {
    const scrollbarWidth = getScrollbarWidth();
    if (scrollbarWidth !== 0) {
        const hasForcedOverlayScrollbar = getScrollbarWidth('overlay') === 0;
        // overflow: overlay on webkit doesn't auto hide the scrollbar
        if (hasForcedOverlayScrollbar) {
            document.body.classList.add("mx_scrollbar_overlay_noautohide");
        } else {
            document.body.classList.add("mx_scrollbar_nooverlay");
            const style = document.createElement('style');
            style.type = 'text/css';
            style.innerText =
                `body.mx_scrollbar_nooverlay { --scrollbar-width: ${scrollbarWidth}px; }`;
            document.head.appendChild(style);
        }
    }
}

const installBodyClassesIfNeeded = (function() {
    let installed = false;
    return function() {
        if (!installed) {
            install();
            installed = true;
        }
    }
})();

export default class AutoHideScrollbar extends React.Component {

    constructor(props) {
        super(props);
        this.onOverflow = this.onOverflow.bind(this);
        this.onUnderflow = this.onUnderflow.bind(this);
        this._collectContainerRef = this._collectContainerRef.bind(this);
    }

    onOverflow() {
        this.containerRef.classList.add("mx_AutoHideScrollbar_overflow");
        this.containerRef.classList.remove("mx_AutoHideScrollbar_underflow");
    }

    onUnderflow() {
        this.containerRef.classList.remove("mx_AutoHideScrollbar_overflow");
        this.containerRef.classList.add("mx_AutoHideScrollbar_underflow");
    }

    _collectContainerRef(ref) {
        if (ref && !this.containerRef) {
            this.containerRef = ref;
            const needsOverflowListener =
                document.body.classList.contains("mx_scrollbar_nooverlay");

            if (needsOverflowListener) {
                this.containerRef.addEventListener("overflow", this.onOverflow);
                this.containerRef.addEventListener("underflow", this.onUnderflow);
            }
            if (ref.scrollHeight > ref.clientHeight) {
                this.onOverflow();
            } else {
                this.onUnderflow();
            }
        }
    }

    componentWillUnmount() {
        if (this.containerRef) {
            this.containerRef.removeEventListener("overflow", this.onOverflow);
            this.containerRef.removeEventListener("underflow", this.onUnderflow);
        }
    }

    render() {
        installBodyClassesIfNeeded();
        return (<div
                    ref={this._collectContainerRef}
                    className={["mx_AutoHideScrollbar", this.props.className].join(" ")}
                >
            { this.props.children }
        </div>);
    }
}
