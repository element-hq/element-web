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

import React, { HTMLProps } from "react";

import { formatSeconds } from "../../../DateUtils";

interface IProps extends Pick<HTMLProps<HTMLSpanElement>, "aria-live" | "role"> {
    seconds: number;
}

/**
 * Simply converts seconds into minutes and seconds. Note that hours will not be
 * displayed, making it possible to see "82:29".
 */
export default class Clock extends React.Component<IProps> {
    public constructor(props) {
        super(props);
    }

    public shouldComponentUpdate(nextProps: Readonly<IProps>): boolean {
        const currentFloor = Math.floor(this.props.seconds);
        const nextFloor = Math.floor(nextProps.seconds);
        return currentFloor !== nextFloor;
    }

    public render() {
        return <span aria-live={this.props["aria-live"]} role={this.props.role} className='mx_Clock'>
            { formatSeconds(this.props.seconds) }
        </span>;
    }
}
