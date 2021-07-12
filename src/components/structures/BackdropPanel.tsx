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
    spacePanelWidth: number;
    roomListWidth: number;
    viewportHeight: number;
}

export default class BackdropPanel extends React.PureComponent<IProps, IState> {
    private spacesCanvasRef = createRef<HTMLCanvasElement>();
    private roomListCanvasRef = createRef<HTMLCanvasElement>();

    private spacesCtx: CanvasRenderingContext2D;
    private roomListCtx: CanvasRenderingContext2D;

    constructor(props: IProps) {
        super(props);
        this.state = {
            spacePanelWidth: 0,
            roomListWidth: 0,
            viewportHeight: UIStore.instance.windowHeight,
        };
    }

    public componentDidMount() {
        this.spacesCtx = this.spacesCanvasRef.current.getContext("2d");
        this.roomListCtx = this.roomListCanvasRef.current.getContext("2d");
        UIStore.instance.on("SpacePanel", this.onResize);
        UIStore.instance.on("LeftPanel", this.onResize);
    }

    public componentWillUnmount() {
        UIStore.instance.off("SpacePanel", this.onResize);
        UIStore.instance.off("LeftPanel", this.onResize);
    }

    public componentDidUpdate() {
        if (this.props.backgroundImage) {
            requestAnimationFrame(this.refreshBackdropImage);
        }
    }

    private onResize = () => {
        const spacePanelDimensions = UIStore.instance.getElementDimensions("SpacePanel");
        const roomListDimensions = UIStore.instance.getElementDimensions("LeftPanel");
        this.setState({
            spacePanelWidth: spacePanelDimensions ? spacePanelDimensions.width : 0,
            roomListWidth: roomListDimensions ? roomListDimensions.width : 0,
            viewportHeight: UIStore.instance.windowHeight,
        });
    };

    private refreshBackdropImage = (): void => {
        const width = this.state.spacePanelWidth + this.state.roomListWidth;
        const height = this.state.viewportHeight;
        const { backgroundImage } = this.props;

        const imageWidth = (backgroundImage as ImageBitmap).width
        || (backgroundImage as HTMLImageElement).naturalWidth;
        const imageHeight = (backgroundImage as ImageBitmap).height
        || (backgroundImage as HTMLImageElement).naturalHeight;

        const contentRatio = imageWidth / imageHeight;
        const containerRatio = width / height;
        let resultHeight;
        let resultWidth;
        if (contentRatio > containerRatio) {
            resultHeight = height;
            resultWidth = height * contentRatio;
        } else {
            resultWidth = width;
            resultHeight = width / contentRatio;
        }

        const x = (width - resultWidth) / 2;
        const y = (height - resultHeight) / 2;

        this.spacesCanvasRef.current.width = this.state.spacePanelWidth;
        this.spacesCanvasRef.current.height = this.state.viewportHeight;
        this.roomListCanvasRef.current.width = this.state.roomListWidth;
        this.roomListCanvasRef.current.height = this.state.viewportHeight;

        this.spacesCtx.filter = `blur(30px)`;
        this.roomListCtx.filter = `blur(60px)`;
        this.spacesCtx.drawImage(
            backgroundImage,
            x,
            y,
            resultWidth,
            resultHeight,
        );
        this.roomListCtx.drawImage(
            backgroundImage,
            0, 0,
            imageWidth, imageHeight,
            x - this.state.spacePanelWidth,
            y,
            resultWidth,
            resultHeight,
        );
    };

    public render() {
        return <>
            <canvas
                ref={this.spacesCanvasRef}
                className="mx_BackdropPanel"
                style={{
                    opacity: .15,
                }}
            />
            <canvas
                style={{
                    transform: `translateX(${this.state.spacePanelWidth}px)`,
                    opacity: .1,
                }}
                ref={this.roomListCanvasRef}
                className="mx_BackdropPanel"
            />
        </>;
    }
}
