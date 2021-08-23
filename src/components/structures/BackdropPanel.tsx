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

import React from "react";
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
    private style = getComputedStyle(document.documentElement);

    public state: IState = {};

    public componentDidMount() {
        this.onResize();
    }

    public componentWillUnmount() {
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
        const leftPanelCanvas = document.createElement('canvas');
        const leftPanelContext = leftPanelCanvas.getContext("2d");
        const { backgroundImage } = this.props;

        const imageWidth = (backgroundImage as ImageBitmap).width;
        const imageHeight = (backgroundImage as ImageBitmap).height;

        leftPanelCanvas.width = window.screen.width * 0.5;
        leftPanelCanvas.height = window.screen.height;

        const roomListBlur = this.style.getPropertyValue('--lp-background-blur');

        leftPanelContext.filter = `blur(${roomListBlur})`;
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

        });
    };

    public render() {
        if (!this.props.backgroundImage) return null;
        return <div className="mx_BackdropPanel">
            { this.state?.lpImage !== 'data:,' && <img
                className="mx_BackdropPanel--canvas"
                src={this.state.lpImage} /> }
        </div>;
    }
}
