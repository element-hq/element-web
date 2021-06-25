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

interface IProps {
    width?: number;
    height?: number;
    backgroundImage?: CanvasImageSource;
    blur?: string;
}


export default class BackdropPanel extends React.PureComponent<IProps> {
    private canvasRef: React.RefObject<HTMLCanvasElement> = createRef();
    private ctx: CanvasRenderingContext2D;

    static defaultProps = {
        blur: "60px",
    }

    public componentDidMount() {
        this.ctx = this.canvasRef.current.getContext("2d");
    }

    public componentDidUpdate() {
        if (this.props.backgroundImage) {
            requestAnimationFrame(this.refreshBackdropImage);
        }
    }

    private refreshBackdropImage = (): void => {
        const { width, height, backgroundImage } = this.props;
        this.canvasRef.current.width = width;
        this.canvasRef.current.height = height;

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

        this.ctx.filter = `blur(${this.props.blur})`;
        this.ctx.drawImage(
            backgroundImage,
            x,
            y,
            resultWidth,
            resultHeight,
        );
    }

    public render() {
        return <canvas
            ref={this.canvasRef}
            className="mx_BackdropPanel"
        />;
    }
}
