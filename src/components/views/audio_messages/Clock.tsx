/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLProps } from "react";
import { Temporal } from "temporal-polyfill";

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

    public shouldComponentUpdate(nextProps: Readonly<Props>): boolean {
        const currentFloor = Math.floor(this.props.seconds);
        const nextFloor = Math.floor(nextProps.seconds);
        return currentFloor !== nextFloor;
    }

    private calculateDuration(seconds: number): string | undefined {
        if (isNaN(seconds)) return undefined;
        return new Temporal.Duration(0, 0, 0, 0, 0, 0, Math.round(seconds))
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
