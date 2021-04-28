/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface IProps {
    seconds: number;
}

interface IState {
}

/**
 * Simply converts seconds into minutes and seconds. Note that hours will not be
 * displayed, making it possible to see "82:29".
 */
@replaceableComponent("views.voice_messages.Clock")
export default class Clock extends React.Component<IProps, IState> {
    public constructor(props) {
        super(props);
    }

    shouldComponentUpdate(nextProps: Readonly<IProps>, nextState: Readonly<IState>, nextContext: any): boolean {
        const currentFloor = Math.floor(this.props.seconds);
        const nextFloor = Math.floor(nextProps.seconds);
        return currentFloor !== nextFloor;
    }

    public render() {
        const minutes = Math.floor(this.props.seconds / 60).toFixed(0).padStart(2, '0');
        const seconds = Math.floor(this.props.seconds % 60).toFixed(0).padStart(2, '0'); // hide millis
        return <span className='mx_Clock'>{minutes}:{seconds}</span>;
    }
}
