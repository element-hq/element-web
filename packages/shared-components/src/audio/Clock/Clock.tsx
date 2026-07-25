/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.
SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type HTMLProps, useMemo } from "react";
import { Temporal } from "temporal-polyfill";
import classNames from "classnames";

import { formatSeconds } from "../../core/utils/DateUtils";

export interface Props extends Pick<HTMLProps<HTMLSpanElement>, "aria-live" | "role" | "className"> {
    /**
     * The number of seconds to display.
     */
    seconds: number;

    /**
     * The number of positions to pad the minutes part.
     *
     * @example
     * If minutesMaxLength = 1, the clock will show 5:31 instead of 05:31.
     */
    minutesMaxLength?: number;

    /**
     * The number of positions to pad the hour part.
     *
     * @example
     * If hoursMaxLength = 1, the clock will show 1:05:31 instead of 01:05:31.
     */
    hoursMaxLength?: number;
}

/**
 * Clock which represents time periods rather than absolute time.
 * Simply converts seconds using formatSeconds().
 * Note that in this case hours will not be displayed, making it possible to see "82:29".
 *
 * @example
 * ```tsx
 * <Clock seconds={125} />
 * ```
 */
export function Clock({ seconds, className, minutesMaxLength, hoursMaxLength, ...rest }: Props): JSX.Element {
    // Memoize current second to avoid recalculating the duration when seconds changes slightly (e.g. 1.2 -> 1.3)
    const currentSecond = useMemo(() => Math.floor(seconds), [seconds]);
    const duration = useMemo(() => calculateDuration(currentSecond), [currentSecond]);

    return (
        <time
            dateTime={duration}
            /* Keep class for backward compatibility with parent component */
            className={classNames("mx_Clock", className)}
            {...rest}
        >
            {formatSeconds(seconds, {
                minutesMaxLength,
                hoursMaxLength,
            })}
        </time>
    );
}

/**
 * Calculates an ISO 8601 duration string from seconds.
 * @param seconds
 * @returns ISO 8601 duration string or undefined if input is NaN
 */
function calculateDuration(seconds: number): string | undefined {
    // This shouldn't happen but it's in the original implementation
    if (isNaN(seconds)) return undefined;

    return new Temporal.Duration(0, 0, 0, 0, 0, 0, Math.round(seconds))
        .round({ smallestUnit: "seconds", largestUnit: "hours" })
        .toString();
}
