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

import SettingsStore from "../../../settings/SettingsStore";
import Draggable, { ILocationState } from "./Draggable";
import { SettingLevel } from "../../../settings/SettingLevel";

interface IProps {
    // Current room
    roomId: string | null;
    minWidth: number;
    maxWidth: number;
}

interface IState {
    width: number;
    IRCLayoutRoot: HTMLElement | null;
}

export default class IRCTimelineProfileResizer extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            width: SettingsStore.getValue("ircDisplayNameWidth", this.props.roomId),
            IRCLayoutRoot: null,
        };
    }

    public componentDidMount(): void {
        this.setState(
            {
                IRCLayoutRoot: document.querySelector(".mx_IRCLayout"),
            },
            () => this.updateCSSWidth(this.state.width),
        );
    }

    private dragFunc = (location: ILocationState, event: MouseEvent): ILocationState => {
        const offset = event.clientX - location.currentX;
        const newWidth = this.state.width + offset;

        // If we're trying to go smaller than min width, don't.
        if (newWidth < this.props.minWidth) {
            return location;
        }

        if (newWidth > this.props.maxWidth) {
            return location;
        }

        this.setState({
            width: newWidth,
        });

        this.updateCSSWidth.bind(this)(newWidth);

        return {
            currentX: event.clientX,
            currentY: location.currentY,
        };
    };

    private updateCSSWidth(newWidth: number): void {
        this.state.IRCLayoutRoot?.style.setProperty("--name-width", newWidth + "px");
    }

    private onMoueUp = (): void => {
        if (this.props.roomId) {
            SettingsStore.setValue(
                "ircDisplayNameWidth",
                this.props.roomId,
                SettingLevel.ROOM_DEVICE,
                this.state.width,
            );
        }
    };

    public render(): React.ReactNode {
        return <Draggable className="mx_ProfileResizer" dragFunc={this.dragFunc} onMouseUp={this.onMoueUp} />;
    }
}
