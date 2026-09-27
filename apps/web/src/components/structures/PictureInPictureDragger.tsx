/*
Copyright 2021-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, createRef } from "react";

import UIStore, { UI_EVENTS } from "../../stores/UIStore";
import { lerp } from "../../utils/AnimationUtils";
import { MarkedExecution } from "../../utils/MarkedExecution";

export const PIP_VIEW_WIDTH = 336;
export const PIP_VIEW_HEIGHT = 232;
/** Between PiPs stacked in slots */
export const PIP_GAP = 16;

const MOVING_AMT = 0.2;
const SNAPPING_AMT = 0.1;

const PADDING = {
    top: 80,
    bottom: 87,
    left: 84,
    right: 16,
};

/**
 * The type of a callback which will create the pip content children.
 */
export type CreatePipChildren = (options: IChildrenOptions) => JSX.Element;

interface IChildrenOptions {
    // a callback which is called when a mouse event (most likely mouse down) occurs at start of moving the pip around
    onStartMoving: (event: React.MouseEvent) => void;
    // a callback which is called when the content fo the pip changes in a way that is likely to cause a resize
    onResize: (event: Event) => void;
}

/**
 * Where a PiP sits relative to the corner it snaps to, when several are shown: `row` PiPs further
 * from the top/bottom edge, `column` PiPs further from the left/right edge. Slot (0, 0) is the corner.
 */
export interface PipSlot {
    column: number;
    row: number;
}

/** How many PiPs fit down one edge of the window, given the padding; at least one. */
export function pipRowsPerColumn(): number {
    const usable = UIStore.instance.windowHeight - PADDING.top - PADDING.bottom;
    return Math.max(1, Math.floor((usable + PIP_GAP) / (PIP_VIEW_HEIGHT + PIP_GAP)));
}

interface IProps {
    children: Array<CreatePipChildren>;
    onDoubleClick?: () => void;
    onMove?: () => void;
    slot?: PipSlot;
}

/**
 * PictureInPictureDragger shows a small version of CallView hovering over the UI in 'picture-in-picture'
 * (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing.
 */
export default class PictureInPictureDragger extends React.Component<IProps> {
    private callViewWrapper = createRef<HTMLDivElement>();
    private initX = 0;
    private initY = 0;
    // Top right, offset by the slot
    private desiredTranslationX = UIStore.instance.windowWidth - PADDING.right - PIP_VIEW_WIDTH - this.slotOffsetX;
    private desiredTranslationY = PADDING.top + this.slotOffsetY;
    private translationX = this.desiredTranslationX;
    private translationY = this.desiredTranslationY;
    private mouseHeld = false;
    private scheduledUpdate: MarkedExecution = new MarkedExecution(
        () => this.animationCallback(),
        () => requestAnimationFrame(() => this.scheduledUpdate.trigger()),
    );
    private startingPositionX = 0;
    private startingPositionY = 0;

    private get slotOffsetX(): number {
        return (this.props.slot?.column ?? 0) * (PIP_VIEW_WIDTH + PIP_GAP);
    }

    private get slotOffsetY(): number {
        return (this.props.slot?.row ?? 0) * (PIP_VIEW_HEIGHT + PIP_GAP);
    }

    private _moving = false;
    public get moving(): boolean {
        return this._moving;
    }
    private set moving(value: boolean) {
        this._moving = value;
    }

    public componentDidMount(): void {
        document.addEventListener("mousemove", this.onMoving);
        document.addEventListener("mouseup", this.onEndMoving);
        UIStore.instance.on(UI_EVENTS.Resize, this.onResize);
        // correctly position the PiP
        this.snap();
    }

    public componentWillUnmount(): void {
        document.removeEventListener("mousemove", this.onMoving);
        document.removeEventListener("mouseup", this.onEndMoving);
        UIStore.instance.off(UI_EVENTS.Resize, this.onResize);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>): void {
        if (prevProps.children !== this.props.children) this.snap(true);
    }

    private animationCallback = (): void => {
        if (
            !this.moving &&
            Math.abs(this.translationX - this.desiredTranslationX) <= 1 &&
            Math.abs(this.translationY - this.desiredTranslationY) <= 1
        ) {
            // Break the loop by settling the element into its final position
            this.translationX = this.desiredTranslationX;
            this.translationY = this.desiredTranslationY;
            this.setStyle();
        } else {
            const amt = this.moving ? MOVING_AMT : SNAPPING_AMT;
            this.translationX = lerp(this.translationX, this.desiredTranslationX, amt);
            this.translationY = lerp(this.translationY, this.desiredTranslationY, amt);

            this.setStyle();
            this.scheduledUpdate.mark();
        }

        this.props.onMove?.();
    };

    private setStyle = (): void => {
        if (!this.callViewWrapper.current) return;
        // Set the element's style directly, bypassing React for efficiency
        this.callViewWrapper.current.style.transform = `translateX(${this.translationX}px) translateY(${this.translationY}px)`;
    };

    private setTranslation(inTranslationX: number, inTranslationY: number): void {
        const width = this.callViewWrapper.current?.clientWidth || PIP_VIEW_WIDTH;
        const height = this.callViewWrapper.current?.clientHeight || PIP_VIEW_HEIGHT;

        // Avoid overflow on the x axis
        if (inTranslationX + width >= UIStore.instance.windowWidth) {
            this.desiredTranslationX = UIStore.instance.windowWidth - width;
        } else if (inTranslationX <= 0) {
            this.desiredTranslationX = 0;
        } else {
            this.desiredTranslationX = inTranslationX;
        }

        // Avoid overflow on the y axis
        if (inTranslationY + height >= UIStore.instance.windowHeight) {
            this.desiredTranslationY = UIStore.instance.windowHeight - height;
        } else if (inTranslationY <= 0) {
            this.desiredTranslationY = 0;
        } else {
            this.desiredTranslationY = inTranslationY;
        }
    }

    private onResize = (): void => {
        this.snap(false);
    };

    private snap = (animate = false): void => {
        const translationX = this.desiredTranslationX;
        const translationY = this.desiredTranslationY;
        // We subtract the PiP size from the window size in order to calculate
        // the position to snap to from the PiP center and not its top-left
        // corner
        const windowWidth =
            UIStore.instance.windowWidth - (this.callViewWrapper.current?.clientWidth || PIP_VIEW_WIDTH);
        const windowHeight =
            UIStore.instance.windowHeight - (this.callViewWrapper.current?.clientHeight || PIP_VIEW_HEIGHT);

        // The slot moves the PiP inwards from whichever corner it snaps to
        const { slotOffsetX, slotOffsetY } = this;
        if (translationX >= windowWidth / 2 && translationY >= windowHeight / 2) {
            this.desiredTranslationX = windowWidth - PADDING.right - slotOffsetX;
            this.desiredTranslationY = windowHeight - PADDING.bottom - slotOffsetY;
        } else if (translationX >= windowWidth / 2 && translationY <= windowHeight / 2) {
            this.desiredTranslationX = windowWidth - PADDING.right - slotOffsetX;
            this.desiredTranslationY = PADDING.top + slotOffsetY;
        } else if (translationX <= windowWidth / 2 && translationY >= windowHeight / 2) {
            this.desiredTranslationX = PADDING.left + slotOffsetX;
            this.desiredTranslationY = windowHeight - PADDING.bottom - slotOffsetY;
        } else {
            this.desiredTranslationX = PADDING.left + slotOffsetX;
            this.desiredTranslationY = PADDING.top + slotOffsetY;
        }

        if (!animate) {
            this.translationX = this.desiredTranslationX;
            this.translationY = this.desiredTranslationY;
        }

        // We start animating here because we want the PiP to move when we're
        // resizing the window
        this.scheduledUpdate.mark();
    };

    private onStartMoving = (event: React.MouseEvent | MouseEvent): void => {
        this.mouseHeld = true;
        this.startingPositionX = event.clientX;
        this.startingPositionY = event.clientY;
    };

    private onMoving = (event: MouseEvent): void => {
        if (!this.mouseHeld) return;

        if (
            Math.abs(this.startingPositionX - event.clientX) < 5 &&
            Math.abs(this.startingPositionY - event.clientY) < 5
        ) {
            // User needs to move the widget by at least five pixels.
            // Improves click detection when using a touchpad or with nervous hands.
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (!this.moving) {
            this.moving = true;
            this.initX = event.pageX - this.desiredTranslationX;
            this.initY = event.pageY - this.desiredTranslationY;
            this.scheduledUpdate.mark();
        }

        this.setTranslation(event.pageX - this.initX, event.pageY - this.initY);
    };

    private onEndMoving = (event: MouseEvent): void => {
        if (!this.mouseHeld) return;

        this.mouseHeld = false;
        // Delaying this to the next event loop tick is necessary for click
        // event cancellation to work
        setTimeout(() => (this.moving = false));
        this.snap(true);
    };

    private onClickCapture = (event: React.MouseEvent): void => {
        // To prevent mouse up events during dragging from being double-counted
        // as clicks, we cancel clicks before they ever reach the target
        if (this.moving) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    public render(): React.ReactNode {
        const style = {
            transform: `translateX(${this.translationX}px) translateY(${this.translationY}px)`,
        };

        const children = this.props.children.map((create: CreatePipChildren) => {
            return create({
                onStartMoving: this.onStartMoving,
                onResize: this.onResize,
            });
        });

        return (
            <aside
                className="mx_PictureInPictureDragger"
                style={style}
                ref={this.callViewWrapper}
                onClickCapture={this.onClickCapture}
                onDoubleClick={this.props.onDoubleClick}
            >
                {children}
            </aside>
        );
    }
}
