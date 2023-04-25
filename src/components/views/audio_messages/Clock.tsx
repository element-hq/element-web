/*
Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

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
import { Temporal } from "proposal-temporal";

import { formatSeconds } from "../../../DateUtils";

interface Props extends Pick<HTMLProps<HTMLSpanElement>, "aria-live" | "role"> {
    seconds: number;
    formatFn: (seconds: number) => string;
}

/**
 * Clock which represents time periods rather than absolute time.
 * Simply converts seconds using formatFn.
 * Defaulting to formatSeconds().
 * Note that in this case hours will not be displayed, making it possible to see "82:29".
 */
export default class Clock extends React.Component<Props> {
    public static defaultProps = {
        formatFn: formatSeconds,
    };

    public constructor(props: Props) {
        super(props);
    }

    public shouldComponentUpdate(nextProps: Readonly<Props>): boolean {
        const currentFloor = Math.floor(this.props.seconds);
        const nextFloor = Math.floor(nextProps.seconds);
        return currentFloor !== nextFloor;
    }

    private calculateDuration(seconds: number): string {
        return new Temporal.Duration(0, 0, 0, 0, 0, 0, seconds)
            .round({ smallestUnit: "seconds", largestUnit: "hours" })
            .toString();
    }

    public render(): React.ReactNode {
        const { seconds, role } = this.props;
        return (
            <time
                dateTime={this.calculateDuration(seconds)}
                aria-live={this.props["aria-live"]}
                role={role}
                className="mx_Clock"
            >
                {this.props.formatFn(seconds)}
            </time>
        );
    }
}
