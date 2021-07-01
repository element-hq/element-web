/*
 Copyright 2020 The Matrix.org Foundation C.I.C.

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
import { decode } from "blurhash";

interface IProps {
    blurhash: string;
    width: number;
    height: number;
}

export default class BlurhashPlaceholder extends React.PureComponent<IProps> {
    private canvas: React.RefObject<HTMLCanvasElement> = React.createRef();

    public componentDidMount() {
        this.draw();
    }

    public componentDidUpdate() {
        this.draw();
    }

    private draw() {
        if (!this.canvas.current) return;

        try {
            const { width, height } = this.props;

            const pixels = decode(this.props.blurhash, Math.ceil(width), Math.ceil(height));
            const ctx = this.canvas.current.getContext("2d");
            const imgData = ctx.createImageData(width, height);
            imgData.data.set(pixels);
            ctx.putImageData(imgData, 0, 0);
        } catch (e) {
            console.error("Error rendering blurhash: ", e);
        }
    }

    public render() {
        return <canvas height={this.props.height} width={this.props.width} ref={this.canvas} />;
    }
}
