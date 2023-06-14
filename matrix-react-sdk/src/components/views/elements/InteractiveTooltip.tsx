/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import React, { CSSProperties, MouseEventHandler, ReactNode, RefCallback } from "react";
import ReactDOM from "react-dom";
import classNames from "classnames";

import UIStore from "../../../stores/UIStore";
import { ChevronFace } from "../../structures/ContextMenu";

const InteractiveTooltipContainerId = "mx_InteractiveTooltip_Container";

// If the distance from tooltip to window edge is below this value, the tooltip
// will flip around to the other side of the target.
const MIN_SAFE_DISTANCE_TO_WINDOW_EDGE = 20;

function getOrCreateContainer(): HTMLElement {
    let container = document.getElementById(InteractiveTooltipContainerId);

    if (!container) {
        container = document.createElement("div");
        container.id = InteractiveTooltipContainerId;
        document.body.appendChild(container);
    }

    return container;
}

interface IRect {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

function isInRect(x: number, y: number, rect: IRect): boolean {
    const { top, right, bottom, left } = rect;
    return x >= left && x <= right && y >= top && y <= bottom;
}

/**
 * Returns the positive slope of the diagonal of the rect.
 *
 * @param {DOMRect} rect
 * @return {number}
 */
function getDiagonalSlope(rect: IRect): number {
    const { top, right, bottom, left } = rect;
    return (bottom - top) / (right - left);
}

function isInUpperLeftHalf(x: number, y: number, rect: IRect): boolean {
    const { bottom, left } = rect;
    // Negative slope because Y values grow downwards and for this case, the
    // diagonal goes from larger to smaller Y values.
    const diagonalSlope = getDiagonalSlope(rect) * -1;
    return isInRect(x, y, rect) && y <= bottom + diagonalSlope * (x - left);
}

function isInLowerRightHalf(x: number, y: number, rect: IRect): boolean {
    const { bottom, left } = rect;
    // Negative slope because Y values grow downwards and for this case, the
    // diagonal goes from larger to smaller Y values.
    const diagonalSlope = getDiagonalSlope(rect) * -1;
    return isInRect(x, y, rect) && y >= bottom + diagonalSlope * (x - left);
}

function isInUpperRightHalf(x: number, y: number, rect: IRect): boolean {
    const { top, left } = rect;
    // Positive slope because Y values grow downwards and for this case, the
    // diagonal goes from smaller to larger Y values.
    const diagonalSlope = getDiagonalSlope(rect) * 1;
    return isInRect(x, y, rect) && y <= top + diagonalSlope * (x - left);
}

function isInLowerLeftHalf(x: number, y: number, rect: IRect): boolean {
    const { top, left } = rect;
    // Positive slope because Y values grow downwards and for this case, the
    // diagonal goes from smaller to larger Y values.
    const diagonalSlope = getDiagonalSlope(rect) * 1;
    return isInRect(x, y, rect) && y >= top + diagonalSlope * (x - left);
}

export enum Direction {
    Top,
    Left,
    Bottom,
    Right,
}

// exported for tests
export function mouseWithinRegion(
    x: number,
    y: number,
    direction: Direction,
    targetRect: DOMRect,
    contentRect: DOMRect,
): boolean {
    // When moving the mouse from the target to the tooltip, we create a safe area
    // that includes the tooltip, the target, and the trapezoid ABCD between them:
    //                            ┌───────────┐
    //                            │           │
    //                            │           │
    //                          A └───E───F───┘ B
    //                                  V
    //                                 ┌─┐
    //                                 │ │
    //                                C└─┘D
    //
    // As long as the mouse remains inside the safe area, the tooltip will stay open.
    const buffer = 50;
    if (isInRect(x, y, targetRect)) {
        return true;
    }

    switch (direction) {
        case Direction.Left: {
            const contentRectWithBuffer = {
                top: contentRect.top - buffer,
                right: contentRect.right,
                bottom: contentRect.bottom + buffer,
                left: contentRect.left - buffer,
            };
            const trapezoidTop = {
                top: contentRect.top - buffer,
                right: targetRect.right,
                bottom: targetRect.top,
                left: contentRect.right,
            };
            const trapezoidCenter = {
                top: targetRect.top,
                right: targetRect.left,
                bottom: targetRect.bottom,
                left: contentRect.right,
            };
            const trapezoidBottom = {
                top: targetRect.bottom,
                right: targetRect.right,
                bottom: contentRect.bottom + buffer,
                left: contentRect.right,
            };

            if (
                isInRect(x, y, contentRectWithBuffer) ||
                isInLowerLeftHalf(x, y, trapezoidTop) ||
                isInRect(x, y, trapezoidCenter) ||
                isInUpperLeftHalf(x, y, trapezoidBottom)
            ) {
                return true;
            }

            break;
        }

        case Direction.Right: {
            const contentRectWithBuffer = {
                top: contentRect.top - buffer,
                right: contentRect.right + buffer,
                bottom: contentRect.bottom + buffer,
                left: contentRect.left,
            };
            const trapezoidTop = {
                top: contentRect.top - buffer,
                right: contentRect.left,
                bottom: targetRect.top,
                left: targetRect.left,
            };
            const trapezoidCenter = {
                top: targetRect.top,
                right: contentRect.left,
                bottom: targetRect.bottom,
                left: targetRect.right,
            };
            const trapezoidBottom = {
                top: targetRect.bottom,
                right: contentRect.left,
                bottom: contentRect.bottom + buffer,
                left: targetRect.left,
            };

            if (
                isInRect(x, y, contentRectWithBuffer) ||
                isInLowerRightHalf(x, y, trapezoidTop) ||
                isInRect(x, y, trapezoidCenter) ||
                isInUpperRightHalf(x, y, trapezoidBottom)
            ) {
                return true;
            }

            break;
        }

        case Direction.Top: {
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
                bottom: targetRect.top,
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
                return true;
            }

            break;
        }

        case Direction.Bottom: {
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
                top: targetRect.bottom,
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
                return true;
            }

            break;
        }
    }

    return false;
}

interface IProps {
    children(props: { ref: RefCallback<HTMLElement>; onMouseOver: MouseEventHandler }): ReactNode;
    // Content to show in the tooltip
    content: ReactNode;
    direction?: Direction;
    // Function to call when visibility of the tooltip changes
    onVisibilityChange?(visible: boolean): void;
}

interface IState {
    contentRect?: DOMRect;
    visible: boolean;
}

/*
 * This style of tooltip takes a "target" element as its child and centers the
 * tooltip along one edge of the target.
 */
export default class InteractiveTooltip extends React.Component<IProps, IState> {
    private target?: HTMLElement;

    public static defaultProps = {
        side: Direction.Top,
    };

    public constructor(props: IProps) {
        super(props);

        this.state = {
            visible: false,
        };
    }

    public componentDidUpdate(): void {
        // Whenever this passthrough component updates, also render the tooltip
        // in a separate DOM tree. This allows the tooltip content to participate
        // the normal React rendering cycle: when this component re-renders, the
        // tooltip content re-renders.
        // Once we upgrade to React 16, this could be done a bit more naturally
        // using the portals feature instead.
        this.renderTooltip();
    }

    public componentWillUnmount(): void {
        document.removeEventListener("mousemove", this.onMouseMove);
    }

    private collectContentRect = (element: HTMLElement | null): void => {
        // We don't need to clean up when unmounting, so ignore
        if (!element) return;

        this.setState({
            contentRect: element.getBoundingClientRect(),
        });
    };

    private collectTarget = (element: HTMLElement): void => {
        this.target = element;
    };

    private onLeftOfTarget(): boolean {
        const { contentRect } = this.state;
        if (!this.target) return false;
        const targetRect = this.target.getBoundingClientRect();

        if (this.props.direction === Direction.Left) {
            const targetLeft = targetRect.left + window.scrollX;
            return !contentRect || targetLeft - contentRect.width > MIN_SAFE_DISTANCE_TO_WINDOW_EDGE;
        } else {
            const targetRight = targetRect.right + window.scrollX;
            const spaceOnRight = UIStore.instance.windowWidth - targetRight;
            return !!contentRect && spaceOnRight - contentRect.width < MIN_SAFE_DISTANCE_TO_WINDOW_EDGE;
        }
    }

    private aboveTarget(): boolean {
        const { contentRect } = this.state;
        if (!this.target) return false;
        const targetRect = this.target.getBoundingClientRect();

        if (this.props.direction === Direction.Top) {
            const targetTop = targetRect.top + window.scrollY;
            return !contentRect || targetTop - contentRect.height > MIN_SAFE_DISTANCE_TO_WINDOW_EDGE;
        } else {
            const targetBottom = targetRect.bottom + window.scrollY;
            const spaceBelow = UIStore.instance.windowHeight - targetBottom;
            return !!contentRect && spaceBelow - contentRect.height < MIN_SAFE_DISTANCE_TO_WINDOW_EDGE;
        }
    }

    private get isOnTheSide(): boolean {
        return this.props.direction === Direction.Left || this.props.direction === Direction.Right;
    }

    private onMouseMove = (ev: MouseEvent): void => {
        const { clientX: x, clientY: y } = ev;
        const { contentRect } = this.state;
        if (!contentRect || !this.target) return;
        const targetRect = this.target.getBoundingClientRect();

        let direction: Direction;
        if (this.isOnTheSide) {
            direction = this.onLeftOfTarget() ? Direction.Left : Direction.Right;
        } else {
            direction = this.aboveTarget() ? Direction.Top : Direction.Bottom;
        }

        if (!mouseWithinRegion(x, y, direction, targetRect, contentRect)) {
            this.hideTooltip();
        }
    };

    private onTargetMouseOver = (): void => {
        this.showTooltip();
    };

    private showTooltip(): void {
        // Don't enter visible state if we haven't collected the target yet
        if (!this.target) return;

        this.setState({
            visible: true,
        });
        this.props.onVisibilityChange?.(true);
        document.addEventListener("mousemove", this.onMouseMove);
    }

    public hideTooltip(): void {
        this.setState({
            visible: false,
        });
        this.props.onVisibilityChange?.(false);
        document.removeEventListener("mousemove", this.onMouseMove);
    }

    private renderTooltip(): ReactNode {
        const { contentRect, visible } = this.state;
        if (!visible) {
            ReactDOM.unmountComponentAtNode(getOrCreateContainer());
            return null;
        }

        if (!this.target) return null;

        const targetRect = this.target.getBoundingClientRect();

        // The window X and Y offsets are to adjust position when zoomed in to page
        const targetLeft = targetRect.left + window.scrollX;
        const targetRight = targetRect.right + window.scrollX;
        const targetBottom = targetRect.bottom + window.scrollY;
        const targetTop = targetRect.top + window.scrollY;

        // Place the tooltip above the target by default. If we find that the
        // tooltip content would extend past the safe area towards the window
        // edge, flip around to below the target.
        const position: Partial<IRect> = {};
        let chevronFace: ChevronFace | null = null;
        if (this.isOnTheSide) {
            if (this.onLeftOfTarget()) {
                position.left = targetLeft;
                chevronFace = ChevronFace.Right;
            } else {
                position.left = targetRight;
                chevronFace = ChevronFace.Left;
            }

            position.top = targetTop;
        } else {
            if (this.aboveTarget()) {
                position.bottom = UIStore.instance.windowHeight - targetTop;
                chevronFace = ChevronFace.Bottom;
            } else {
                position.top = targetBottom;
                chevronFace = ChevronFace.Top;
            }

            // Center the tooltip horizontally with the target's center.
            position.left = targetLeft + targetRect.width / 2;
        }

        const chevron = <div className={"mx_InteractiveTooltip_chevron_" + chevronFace} />;

        const menuClasses = classNames("mx_InteractiveTooltip", {
            mx_InteractiveTooltip_withChevron_top: chevronFace === ChevronFace.Top,
            mx_InteractiveTooltip_withChevron_left: chevronFace === ChevronFace.Left,
            mx_InteractiveTooltip_withChevron_right: chevronFace === ChevronFace.Right,
            mx_InteractiveTooltip_withChevron_bottom: chevronFace === ChevronFace.Bottom,
        });

        const menuStyle: CSSProperties = {};
        if (contentRect && !this.isOnTheSide) {
            menuStyle.left = `-${contentRect.width / 2}px`;
        }

        const tooltip = (
            <div className="mx_InteractiveTooltip_wrapper" style={{ ...position }}>
                <div className={menuClasses} style={menuStyle} ref={this.collectContentRect}>
                    {chevron}
                    {this.props.content}
                </div>
            </div>
        );

        ReactDOM.render(tooltip, getOrCreateContainer());
    }

    public render(): ReactNode {
        return this.props.children({
            ref: this.collectTarget,
            onMouseOver: this.onTargetMouseOver,
        });
    }
}
