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

// If the distance from tooltip to window edge is below this value, the tooltip
// will flip around to the other side of the target.
const MIN_SAFE_DISTANCE_TO_WINDOW_EDGE = 20;

function getOrCreateContainer() {
    let container = document.getElementById(InteractiveTooltipContainerId);

    if (!container) {
        container = document.createElement("div");
        container.id = InteractiveTooltipContainerId;
        document.body.appendChild(container);
    }

    return container;
}

function isInRect(x, y, rect) {
    const { top, right, bottom, left } = rect;
    return x >= left && x <= right && y >= top && y <= bottom;
}

/**
 * Returns the positive slope of the diagonal of the rect.
 *
 * @param {DOMRect} rect
 * @return {integer}
 */
function getDiagonalSlope(rect) {
    const { top, right, bottom, left } = rect;
    return (bottom - top) / (right - left);
}

function isInUpperLeftHalf(x, y, rect) {
    const { bottom, left } = rect;
    // Negative slope because Y values grow downwards and for this case, the
    // diagonal goes from larger to smaller Y values.
    const diagonalSlope = getDiagonalSlope(rect) * -1;
    return isInRect(x, y, rect) && (y <= bottom + diagonalSlope * (x - left));
}

function isInLowerRightHalf(x, y, rect) {
    const { bottom, left } = rect;
    // Negative slope because Y values grow downwards and for this case, the
    // diagonal goes from larger to smaller Y values.
    const diagonalSlope = getDiagonalSlope(rect) * -1;
    return isInRect(x, y, rect) && (y >= bottom + diagonalSlope * (x - left));
}

function isInUpperRightHalf(x, y, rect) {
    const { top, left } = rect;
    // Positive slope because Y values grow downwards and for this case, the
    // diagonal goes from smaller to larger Y values.
    const diagonalSlope = getDiagonalSlope(rect) * 1;
    return isInRect(x, y, rect) && (y <= top + diagonalSlope * (x - left));
}

function isInLowerLeftHalf(x, y, rect) {
    const { top, left } = rect;
    // Positive slope because Y values grow downwards and for this case, the
    // diagonal goes from smaller to larger Y values.
    const diagonalSlope = getDiagonalSlope(rect) * 1;
    return isInRect(x, y, rect) && (y >= top + diagonalSlope * (x - left));
}

/*
 * This style of tooltip takes a "target" element as its child and centers the
 * tooltip along one edge of the target.
 */
export default class InteractiveTooltip extends React.Component {
    static propTypes = {
        // Content to show in the tooltip
        content: PropTypes.node.isRequired,
        // Function to call when visibility of the tooltip changes
        onVisibilityChange: PropTypes.func,
        // flag to forcefully hide this tooltip
        forceHidden: PropTypes.bool,
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

    componentWillUnmount() {
        document.removeEventListener("mousemove", this.onMouseMove);
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

    canTooltipFitAboveTarget() {
        const { contentRect } = this.state;
        const targetRect = this.target.getBoundingClientRect();
        const targetTop = targetRect.top + window.pageYOffset;
        return (
            !contentRect ||
            (targetTop - contentRect.height > MIN_SAFE_DISTANCE_TO_WINDOW_EDGE)
        );
    }

    onMouseMove = (ev) => {
        const { clientX: x, clientY: y } = ev;
        const { contentRect } = this.state;
        const targetRect = this.target.getBoundingClientRect();

        // When moving the mouse from the target to the tooltip, we create a
        // safe area that includes the tooltip, the target, and the trapezoid
        // ABCD between them:
        //                            ┌───────────┐
        //                            │           │
        //                            │           │
        //                          A └───E───F───┘ B
        //                                  V
        //                                 ┌─┐
        //                                 │ │
        //                                C└─┘D
        //
        // As long as the mouse remains inside the safe area, the tooltip will
        // stay open.
        const buffer = 50;
        if (isInRect(x, y, targetRect)) {
            return;
        }
        if (this.canTooltipFitAboveTarget()) {
            const contentRectWithBuffer = {
                top: contentRect.top - buffer,
                right: contentRect.right + buffer,
                bottom: contentRect.bottom,
                left: contentRect.left - buffer,
            };
            const trapezoidLeft = {
                top: contentRect.bottom,
                right: targetRect.left,
                bottom: targetRect.bottom,
                left: contentRect.left - buffer,
            };
            const trapezoidCenter = {
                top: contentRect.bottom,
                right: targetRect.right,
                bottom: targetRect.bottom,
                left: targetRect.left,
            };
            const trapezoidRight = {
                top: contentRect.bottom,
                right: contentRect.right + buffer,
                bottom: targetRect.bottom,
                left: targetRect.right,
            };

            if (
                isInRect(x, y, contentRectWithBuffer) ||
                isInUpperRightHalf(x, y, trapezoidLeft) ||
                isInRect(x, y, trapezoidCenter) ||
                isInUpperLeftHalf(x, y, trapezoidRight)
            ) {
                return;
            }
        } else {
            const contentRectWithBuffer = {
                top: contentRect.top,
                right: contentRect.right + buffer,
                bottom: contentRect.bottom + buffer,
                left: contentRect.left - buffer,
            };
            const trapezoidLeft = {
                top: targetRect.top,
                right: targetRect.left,
                bottom: contentRect.top,
                left: contentRect.left - buffer,
            };
            const trapezoidCenter = {
                top: targetRect.top,
                right: targetRect.right,
                bottom: contentRect.top,
                left: targetRect.left,
            };
            const trapezoidRight = {
                top: targetRect.top,
                right: contentRect.right + buffer,
                bottom: contentRect.top,
                left: targetRect.right,
            };

            if (
                isInRect(x, y, contentRectWithBuffer) ||
                isInLowerRightHalf(x, y, trapezoidLeft) ||
                isInRect(x, y, trapezoidCenter) ||
                isInLowerLeftHalf(x, y, trapezoidRight)
            ) {
                return;
            }
        }

        this.hideTooltip();
    }

    onTargetMouseOver = (ev) => {
        this.showTooltip();
    }

    showTooltip() {
        // Don't enter visible state if we haven't collected the target yet
        if (!this.target) {
            return;
        }
        this.setState({
            visible: true,
        });
        if (this.props.onVisibilityChange) {
            this.props.onVisibilityChange(true);
        }
        document.addEventListener("mousemove", this.onMouseMove);
    }

    hideTooltip() {
        this.setState({
            visible: false,
        });
        if (this.props.onVisibilityChange) {
            this.props.onVisibilityChange(false);
        }
        document.removeEventListener("mousemove", this.onMouseMove);
    }

    renderTooltip() {
        const { contentRect, visible } = this.state;
        if (this.props.forceHidden === true || !visible) {
            ReactDOM.render(null, getOrCreateContainer());
            return null;
        }

        const targetRect = this.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const targetLeft = targetRect.left + window.pageXOffset;
        const targetBottom = targetRect.bottom + window.pageYOffset;
        const targetTop = targetRect.top + window.pageYOffset;

        // Place the tooltip above the target by default. If we find that the
        // tooltip content would extend past the safe area towards the window
        // edge, flip around to below the target.
        const position = {};
        let chevronFace = null;
        if (this.canTooltipFitAboveTarget()) {
            position.bottom = window.innerHeight - targetTop;
            chevronFace = "bottom";
        } else {
            position.top = targetBottom;
            chevronFace = "top";
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
        if (contentRect) {
            menuStyle.left = `-${contentRect.width / 2}px`;
        }

        const tooltip = <div className="mx_InteractiveTooltip_wrapper" style={{...position}}>
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
