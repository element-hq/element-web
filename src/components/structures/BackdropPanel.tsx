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

import React, { createRef } from "react";
import "context-filter-polyfill";

import UIStore from "../../stores/UIStore";

interface IProps {
    backgroundImage?: CanvasImageSource;
}

interface IState {
    // Left Panel image
    lpImage?: string;
    // Left-left panel image
    llpImage?: string;
}

export default class BackdropPanel extends React.PureComponent<IProps, IState> {
    private sizes = {
        leftLeftPanelWidth: 0,
        leftPanelWidth: 0,
        height: 0,
    };
    private style = getComputedStyle(document.documentElement);

    public state: IState = {};

    public componentDidMount() {
        UIStore.instance.on("SpacePanel", this.onResize);
        UIStore.instance.on("GroupFilterPanelContainer", this.onResize);
        this.onResize();
    }

    public componentWillUnmount() {
        UIStore.instance.off("SpacePanel", this.onResize);
        UIStore.instance.on("GroupFilterPanelContainer", this.onResize);
    }

    public componentDidUpdate(prevProps: IProps) {
        if (prevProps.backgroundImage !== this.props.backgroundImage) {
            this.setState({});
            this.onResize();
        }
    }

    private onResize = () => {
        if (this.props.backgroundImage) {
            const groupFilterPanelDimensions = UIStore.instance.getElementDimensions("GroupFilterPanelContainer");
            const spacePanelDimensions = UIStore.instance.getElementDimensions("SpacePanel");
            const roomListDimensions = UIStore.instance.getElementDimensions("LeftPanel");
            this.sizes = {
                leftLeftPanelWidth: spacePanelDimensions?.width ?? groupFilterPanelDimensions?.width ?? 0,
                leftPanelWidth: roomListDimensions?.width ?? 0,
                height: UIStore.instance.windowHeight,
            };
            this.refreshBackdropImage();
        }
    };

    private refreshBackdropImage = (): void => {
        const leftLeftPanelCanvas = document.createElement('canvas');
        const leftPanelCanvas = document.createElement('canvas');
        const leftLeftPanelContext = leftLeftPanelCanvas.getContext("2d");
        const leftPanelContext = leftPanelCanvas.getContext("2d");
        const { leftLeftPanelWidth, height } = this.sizes;
        const { backgroundImage } = this.props;

        const imageWidth = (backgroundImage as ImageBitmap).width;
        const imageHeight = (backgroundImage as ImageBitmap).height;
        // This value has been chosen to be as close with rendering as the css-only
        // backdrop-filter: blur effect was, mostly takes effect for vertical pictures.

        leftLeftPanelCanvas.width = leftLeftPanelWidth;
        leftLeftPanelCanvas.height = height;
        leftPanelCanvas.width = window.screen.width * 0.5;
        leftPanelCanvas.height = height;

        const spacesBlur = this.style.getPropertyValue('--llp-background-blur');
        const roomListBlur = this.style.getPropertyValue('--lp-background-blur');

        leftLeftPanelContext.filter = `blur(${spacesBlur})`;
        leftPanelContext.filter = `blur(${roomListBlur})`;
        leftLeftPanelContext.drawImage(
            backgroundImage,
            0, 0,
            imageWidth, imageHeight,
            0,
            0,
            leftLeftPanelWidth,
            window.screen.height,
        );
        leftPanelContext.drawImage(
            backgroundImage,
            0, 0,
            imageWidth, imageHeight,
            0,
            0,
            window.screen.width * 0.5,
            window.screen.height,
        );
        this.setState({
            lpImage: leftPanelCanvas.toDataURL('image/jpeg', 1),
            llpImage: leftLeftPanelCanvas.toDataURL('image/jpeg', 1),

        });
    };

    public render() {
        if (!this.props.backgroundImage) return null;
        return <div className="mx_BackdropPanel">
            { this.state?.llpImage !== 'data:,' && <img
                className="mx_BackdropPanel--canvas"
                src={this.state.llpImage} /> }

            { this.state?.lpImage !== 'data:,' && <img
                className="mx_BackdropPanel--canvas"
                src={this.state.lpImage} /> }
        </div>;
    }
}
