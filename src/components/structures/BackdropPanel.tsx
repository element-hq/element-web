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

export default class BackdropPanel extends React.PureComponent<IProps> {
    private spacesCanvasRef = createRef<HTMLCanvasElement>();
    private roomListCanvasRef = createRef<HTMLCanvasElement>();

    private sizes = {
        spacePanelWidth: 0,
        roomListWidth: 0,
        height: 0,
    };
    private style = getComputedStyle(document.documentElement);

    constructor(props: IProps) {
        super(props);
    }

    public componentDidMount() {
        UIStore.instance.on("SpacePanel", this.onResize);
        UIStore.instance.on("LeftPanel", this.onResize);
        this.onResize();
    }

    public componentWillUnmount() {
        UIStore.instance.off("SpacePanel", this.onResize);
        UIStore.instance.off("LeftPanel", this.onResize);
    }

    public componentDidUpdate(prevProps: IProps) {
        if (this.props.backgroundImage) {
            this.onResize();
        }
        if (prevProps.backgroundImage && !this.props.backgroundImage) {
            this.forceUpdate();
        }
    }

    private onResize = () => {
        if (this.props.backgroundImage) {
            const spacePanelDimensions = UIStore.instance.getElementDimensions("SpacePanel");
            const roomListDimensions = UIStore.instance.getElementDimensions("LeftPanel");
            this.sizes = {
                spacePanelWidth: spacePanelDimensions?.width ?? 0,
                roomListWidth: roomListDimensions?.width ?? 0,
                height: UIStore.instance.windowHeight,
            };
            this.refreshBackdropImage();
        }
    };

    private refreshBackdropImage = (): void => {
        const spacesCtx = this.spacesCanvasRef.current.getContext("2d");
        const roomListCtx = this.roomListCanvasRef.current.getContext("2d");
        const { spacePanelWidth, roomListWidth, height } = this.sizes;
        const width = spacePanelWidth + roomListWidth;
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

        this.spacesCanvasRef.current.width = spacePanelWidth;
        this.spacesCanvasRef.current.height = height;
        this.roomListCanvasRef.current.width = roomListWidth;
        this.roomListCanvasRef.current.height = height;
        this.roomListCanvasRef.current.style.transform = `translateX(${spacePanelWidth}px)`;

        const spacesBlur = this.style.getPropertyValue('--roomlist-background-blur-amount');
        const roomListBlur = this.style.getPropertyValue('--groupFilterPanel-background-blur-amount');

        spacesCtx.filter = `blur(${spacesBlur})`;
        roomListCtx.filter = `blur(${roomListBlur})`;
        spacesCtx.drawImage(
            backgroundImage,
            0, 0,
            imageWidth, imageHeight,
            x,
            y,
            resultWidth,
            resultHeight,
        );
        roomListCtx.drawImage(
            backgroundImage,
            0, 0,
            imageWidth, imageHeight,
            x - spacePanelWidth,
            y,
            resultWidth,
            resultHeight,
        );
    };

    public render() {
        if (!this.props.backgroundImage) return null;
        return <div>
            <canvas
                ref={this.spacesCanvasRef}
                className="mx_BackdropPanel"
                style={{
                    opacity: .19,
                }}
            />
            <canvas
                style={{
                    transform: `translateX(0)`,
                    opacity: .12,
                }}
                ref={this.roomListCanvasRef}
                className="mx_BackdropPanel"
            />
        </div>;
    }
}
