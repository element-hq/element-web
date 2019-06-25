/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';

const InteractiveTooltipContainerId = "mx_InteractiveTooltip_Container";

function getOrCreateContainer() {
    let container = document.getElementById(InteractiveTooltipContainerId);

    if (!container) {
        container = document.createElement("div");
        container.id = InteractiveTooltipContainerId;
        document.body.appendChild(container);
    }

    return container;
}

function isInRect(x, y, rect, buffer = 10) {
    const { top, right, bottom, left } = rect;
    return x >= (left - buffer) && x <= (right + buffer)
        && y >= (top - buffer) && y <= (bottom + buffer);
}

/*
 * This style of tooltip takes a "target" element as its child and centers the
 * tooltip along one edge of the target.
 */
export default class InteractiveTooltip extends React.Component {
    propTypes: {
        // Content to show in the tooltip
        content: PropTypes.node.isRequired,
        // Function to call when visibility of the tooltip changes
        onVisibilityChange: PropTypes.func,
    };

    constructor() {
        super();

        this.state = {
            contentRect: null,
            visible: false,
        };
    }

    componentDidUpdate() {
        // Whenever this passthrough component updates, also render the tooltip
        // in a separate DOM tree. This allows the tooltip content to participate
        // the normal React rendering cycle: when this component re-renders, the
        // tooltip content re-renders.
        // Once we upgrade to React 16, this could be done a bit more naturally
        // using the portals feature instead.
        this.renderTooltip();
    }

    collectContentRect = (element) => {
        // We don't need to clean up when unmounting, so ignore
        if (!element) return;

        this.setState({
            contentRect: element.getBoundingClientRect(),
        });
    }

    collectTarget = (element) => {
        this.target = element;
    }

    onBackgroundClick = (ev) => {
        this.hideTooltip();
    }

    onBackgroundMouseMove = (ev) => {
        const { clientX: x, clientY: y } = ev;
        const { contentRect } = this.state;
        const targetRect = this.target.getBoundingClientRect();

        if (!isInRect(x, y, contentRect) && !isInRect(x, y, targetRect)) {
            this.hideTooltip();
            return;
        }
    }

    onTargetMouseOver = (ev) => {
        this.showTooltip();
    }

    showTooltip() {
        this.setState({
            visible: true,
        });
        if (this.props.onVisibilityChange) {
            this.props.onVisibilityChange(true);
        }
    }

    hideTooltip() {
        this.setState({
            visible: false,
        });
        if (this.props.onVisibilityChange) {
            this.props.onVisibilityChange(false);
        }
    }

    renderTooltip() {
        const { visible } = this.state;
        if (!visible) {
            ReactDOM.unmountComponentAtNode(getOrCreateContainer());
            return null;
        }

        const targetRect = this.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const targetLeft = targetRect.left + window.pageXOffset;
        const targetBottom = targetRect.bottom + window.pageYOffset;
        const targetTop = targetRect.top + window.pageYOffset;

        // Align the tooltip vertically on whichever side of the target has more
        // space available.
        const position = {};
        let chevronFace = null;
        if (targetBottom < window.innerHeight / 2) {
            position.top = targetBottom;
            chevronFace = "top";
        } else {
            position.bottom = window.innerHeight - targetTop;
            chevronFace = "bottom";
        }

        // Center the tooltip horizontally with the target's center.
        position.left = targetLeft + targetRect.width / 2;

        const chevron = <div className={"mx_InteractiveTooltip_chevron_" + chevronFace} />;

        const menuClasses = classNames({
            'mx_InteractiveTooltip': true,
            'mx_InteractiveTooltip_withChevron_top': chevronFace === 'top',
            'mx_InteractiveTooltip_withChevron_bottom': chevronFace === 'bottom',
        });

        const menuStyle = {};
        if (this.state.contentRect) {
            menuStyle.left = `-${this.state.contentRect.width / 2}px`;
        }

        const tooltip = <div className="mx_InteractiveTooltip_wrapper" style={{...position}}>
            <div className="mx_ContextualMenu_background"
                onMouseMove={this.onBackgroundMouseMove}
                onClick={this.onBackgroundClick}
            />
            <div className={menuClasses}
                style={menuStyle}
                ref={this.collectContentRect}
            >
                {chevron}
                {this.props.content}
            </div>
        </div>;

        ReactDOM.render(tooltip, getOrCreateContainer());
    }

    render() {
        // We use `cloneElement` here to append some props to the child content
        // without using a wrapper element which could disrupt layout.
        return React.cloneElement(this.props.children, {
            ref: this.collectTarget,
            onMouseOver: this.onTargetMouseOver,
        });
    }
}
