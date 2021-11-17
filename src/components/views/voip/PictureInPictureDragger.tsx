/*
Copyright 2021 New Vector Ltd

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

import React, { createRef } from 'react';
import UIStore from '../../../stores/UIStore';
import { lerp } from '../../../utils/AnimationUtils';
import { MarkedExecution } from '../../../utils/MarkedExecution';
import { replaceableComponent } from '../../../utils/replaceableComponent';

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

interface IChildrenOptions {
    onStartMoving: (event: React.MouseEvent<Element, MouseEvent>) => void;
    onResize: (event: Event) => void;
}

interface IProps {
    className?: string;
    children: ({ onStartMoving, onResize }: IChildrenOptions) => React.ReactNode;
    draggable: boolean;
    onDoubleClick?: () => void;
}

interface IState {
    // Position of the PictureInPictureDragger
    translationX: number;
    translationY: number;
}

/**
 * PictureInPictureDragger shows a small version of CallView hovering over the UI in 'picture-in-picture'
 * (PiP mode). It displays the call(s) which is *not* in the room the user is currently viewing.
 */
@replaceableComponent("views.voip.PictureInPictureDragger")
export default class PictureInPictureDragger extends React.Component<IProps, IState> {
    private callViewWrapper = createRef<HTMLDivElement>();
    private initX = 0;
    private initY = 0;
    private desiredTranslationX = UIStore.instance.windowWidth - PADDING.right - PIP_VIEW_WIDTH;
    private desiredTranslationY = UIStore.instance.windowHeight - PADDING.bottom - PIP_VIEW_HEIGHT;
    private moving = false;
    private scheduledUpdate = new MarkedExecution(
        () => this.animationCallback(),
        () => requestAnimationFrame(() => this.scheduledUpdate.trigger()),
    );

    constructor(props: IProps) {
        super(props);

        this.state = {
            translationX: UIStore.instance.windowWidth - PADDING.right - PIP_VIEW_WIDTH,
            translationY: UIStore.instance.windowHeight - PADDING.bottom - PIP_VIEW_HEIGHT,
        };
    }

    public componentDidMount() {
        document.addEventListener("mousemove", this.onMoving);
        document.addEventListener("mouseup", this.onEndMoving);
        window.addEventListener("resize", this.onResize);
    }

    public componentWillUnmount() {
        document.removeEventListener("mousemove", this.onMoving);
        document.removeEventListener("mouseup", this.onEndMoving);
        window.removeEventListener("resize", this.onResize);
    }

    private animationCallback = () => {
        // If the PiP isn't being dragged and there is only a tiny difference in
        // the desiredTranslation and translation, quit the animationCallback
        // loop. If that is the case, it means the PiP has snapped into its
        // position and there is nothing to do. Not doing this would cause an
        // infinite loop
        if (
            !this.moving &&
            Math.abs(this.state.translationX - this.desiredTranslationX) <= 1 &&
            Math.abs(this.state.translationY - this.desiredTranslationY) <= 1
        ) return;

        const amt = this.moving ? MOVING_AMT : SNAPPING_AMT;
        this.setState({
            translationX: lerp(this.state.translationX, this.desiredTranslationX, amt),
            translationY: lerp(this.state.translationY, this.desiredTranslationY, amt),
        });
        this.scheduledUpdate.mark();
    };

    private setTranslation(inTranslationX: number, inTranslationY: number) {
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

    private snap = (animate = false) => {
        const translationX = this.desiredTranslationX;
        const translationY = this.desiredTranslationY;
        // We subtract the PiP size from the window size in order to calculate
        // the position to snap to from the PiP center and not its top-left
        // corner
        const windowWidth = (
            UIStore.instance.windowWidth -
            (this.callViewWrapper.current?.clientWidth || PIP_VIEW_WIDTH)
        );
        const windowHeight = (
            UIStore.instance.windowHeight -
            (this.callViewWrapper.current?.clientHeight || PIP_VIEW_HEIGHT)
        );

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

        // We start animating here because we want the PiP to move when we're
        // resizing the window
        this.scheduledUpdate.mark();

        if (animate) {
            // We start animating here because we want the PiP to move when we're
            // resizing the window
            this.scheduledUpdate.mark();
        } else {
            this.setState({
                translationX: this.desiredTranslationX,
                translationY: this.desiredTranslationY,
            });
        }
    };

    private onStartMoving = (event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        this.moving = true;
        this.initX = event.pageX - this.desiredTranslationX;
        this.initY = event.pageY - this.desiredTranslationY;
        this.scheduledUpdate.mark();
    };

    private onMoving = (event: React.MouseEvent | MouseEvent) => {
        if (!this.moving) return;

        event.preventDefault();
        event.stopPropagation();

        this.setTranslation(event.pageX - this.initX, event.pageY - this.initY);
    };

    private onEndMoving = () => {
        this.moving = false;
        this.snap(true);
    };

    public render() {
        const translatePixelsX = this.state.translationX + "px";
        const translatePixelsY = this.state.translationY + "px";
        const style = {
            transform: `translateX(${translatePixelsX})
                        translateY(${translatePixelsY})`,
        };
        return (
            <div
                className={this.props.className}
                style={this.props.draggable ? style : undefined}
                ref={this.callViewWrapper}
                onDoubleClick={this.props.onDoubleClick}
            >
                <>
                    { this.props.children({
                        onStartMoving: this.onStartMoving,
                        onResize: this.onResize,
                    }) }
                </>
            </div>
        );
    }
}
