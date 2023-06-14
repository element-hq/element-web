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

import React from "react";

interface IProps {
    className: string;
    dragFunc: (currentLocation: ILocationState, event: MouseEvent) => ILocationState;
    onMouseUp: (event: MouseEvent) => void;
}

interface IState {
    onMouseMove: (event: MouseEvent) => void;
    onMouseUp: (event: MouseEvent) => void;
    location: ILocationState;
}

export interface ILocationState {
    currentX: number;
    currentY: number;
}

export default class Draggable extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            onMouseMove: this.onMouseMove.bind(this),
            onMouseUp: this.onMouseUp.bind(this),
            location: {
                currentX: 0,
                currentY: 0,
            },
        };
    }

    private onMouseDown = (event: React.MouseEvent): void => {
        this.setState({
            location: {
                currentX: event.clientX,
                currentY: event.clientY,
            },
        });

        document.addEventListener("mousemove", this.state.onMouseMove);
        document.addEventListener("mouseup", this.state.onMouseUp);
    };

    private onMouseUp = (event: MouseEvent): void => {
        document.removeEventListener("mousemove", this.state.onMouseMove);
        document.removeEventListener("mouseup", this.state.onMouseUp);
        this.props.onMouseUp(event);
    };

    private onMouseMove(event: MouseEvent): void {
        const newLocation = this.props.dragFunc(this.state.location, event);

        this.setState({
            location: newLocation,
        });
    }

    public render(): React.ReactNode {
        return <div className={this.props.className} onMouseDown={this.onMouseDown} />;
    }
}
