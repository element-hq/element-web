/*
Copyright 2021-2022 New Vector Ltd

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

import UIStore, { UI_EVENTS } from "../../stores/UIStore";
import { lerp } from "../../utils/AnimationUtils";
import { MarkedExecution } from "../../utils/MarkedExecution";

const PIP_VIEW_WIDTH = 336;
const PIP_VIEW_HEIGHT = 232;

const MOVING_AMT = 0.2;
const SNAPPING_AMT = 0.1;

const PADDING = {
    top: 58,
    bottom: 58,
    left: 76,
    right: 8,
};

/**
 * The type of a callback which will create the pip content children.
 */
export type CreatePipChildren = (options: IChildrenOptions) => JSX.Element;

interface IChildrenOptions {
    // a callback which is called when a mouse event (most likely mouse down) occurs at start of moving the pip around
    onStartMoving: (event: React.MouseEvent<Element, MouseEvent>) => void;
    // a callback which is called when the content fo the pip changes in a way that is likely to cause a resize
    onResize: (event: Event) => void;
}

interface IProps {
    className?: string;
    children: Array<CreatePipChildren>;
    draggable: boolean;
    onDoubleClick?: () => void;
    onMove?: () => void;
}

/**
 * PictureInPictureDragger shows a small version of CallView hovering over the UI in 'picture-in-picture'
 * (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing.
 */
export default class PictureInPictureDragger extends React.Component<IProps> {
    private callViewWrapper = createRef<HTMLDivElement>();
    private initX = 0;
    private initY = 0;
    private desiredTranslationX = UIStore.instance.windowWidth - PADDING.right - PIP_VIEW_WIDTH;
    private desiredTranslationY = UIStore.instance.windowHeight - PADDING.bottom - PIP_VIEW_HEIGHT;
    private translationX = this.desiredTranslationX;
    private translationY = this.desiredTranslationY;
    private mouseHeld = false;
    private scheduledUpdate: MarkedExecution = new MarkedExecution(
        () => this.animationCallback(),
        () => requestAnimationFrame(() => this.scheduledUpdate.trigger()),
    );
    private startingPositionX = 0;
    private startingPositionY = 0;

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

        if (translationX >= windowWidth / 2 && translationY >= windowHeight / 2) {
            this.desiredTranslationX = windowWidth - PADDING.right;
            this.desiredTranslationY = windowHeight - PADDING.bottom;
        } else if (translationX >= windowWidth / 2 && translationY <= windowHeight / 2) {
            this.desiredTranslationX = windowWidth - PADDING.right;
            this.desiredTranslationY = PADDING.top;
        } else if (translationX <= windowWidth / 2 && translationY >= windowHeight / 2) {
            this.desiredTranslationX = PADDING.left;
            this.desiredTranslationY = windowHeight - PADDING.bottom;
        } else {
            this.desiredTranslationX = PADDING.left;
            this.desiredTranslationY = PADDING.top;
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
        event.preventDefault();
        event.stopPropagation();

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

        event.preventDefault();
        event.stopPropagation();

        this.mouseHeld = false;
        // Delaying this to the next event loop tick is necessary for click
        // event cancellation to work
        setImmediate(() => (this.moving = false));
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
                className={this.props.className}
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
