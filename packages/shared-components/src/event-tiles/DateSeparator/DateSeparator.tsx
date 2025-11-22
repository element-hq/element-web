/*
 * Copyright 2025 Element Creations Ltd.
 * Copyright 2015-2021 The Matrix.org Foundation C.I.C.
 * Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useMemo } from "react";
import classNames from "classnames";

import { _t } from "../../utils/i18n";
import { formatFullDateNoTime, getDaysArray, DAY_MS } from "../../utils/DateUtils";
import styles from "./DateSeparator.module.css";

export interface Props {
    /** The timestamp (in milliseconds) to display */
    ts: number;
    /** The locale to use for formatting. Defaults to "en" */
    locale?: string;
    /** Whether to disable relative timestamps (e.g., "Today", "Yesterday"). If true, always shows full date */
    disableRelativeTimestamps?: boolean;
    /** Additional CSS class name */
    className?: string;
}

/**
 * Get the label for a date separator
 * @param ts - The timestamp (in milliseconds) to display
 * @param locale - The locale to use for formatting
 * @param disableRelativeTimestamps - Whether to disable relative timestamps
 * @returns The formatted label string
 */
function getLabel(ts: number, locale: string, disableRelativeTimestamps: boolean): string {
    try {
        const date = new Date(ts);

        // If relative timestamps are disabled, return the full date
        if (disableRelativeTimestamps) return formatFullDateNoTime(date, locale);

        const today = new Date();
        const yesterday = new Date();
        const days = getDaysArray("long", locale);
        const relativeTimeFormat = new Intl.RelativeTimeFormat(locale, { style: "long", numeric: "auto" });
        yesterday.setDate(today.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return relativeTimeFormat.format(0, "day"); // Today
        } else if (date.toDateString() === yesterday.toDateString()) {
            return relativeTimeFormat.format(-1, "day"); // Yesterday
        } else if (today.getTime() - date.getTime() < 6 * DAY_MS) {
            return days[date.getDay()]; // Sunday-Saturday
        } else {
            return formatFullDateNoTime(date, locale);
        }
    } catch {
        return _t("common|message_timestamp_invalid");
    }
}

/**
 * Timeline separator component to render within a MessagePanel bearing the date of the ts given
 */
export const DateSeparator: React.FC<Props> = ({ ts, locale = "en", disableRelativeTimestamps = false, className }) => {
    const label = useMemo(
        () => getLabel(ts, locale, disableRelativeTimestamps),
        [ts, locale, disableRelativeTimestamps],
    );

    return (
        <div
            className={classNames(styles.dateSeparator, "mx_DateSeparator", className)}
            role="separator"
            aria-label={label}
        >
            <hr role="none" />
            <div className={classNames(styles.dateContent, "mx_DateSeparator_dateContent")}>
                <h2 className={classNames(styles.dateHeading, "mx_DateSeparator_dateHeading")} aria-hidden="true">
                    {label}
                </h2>
            </div>
            <hr role="none" />
        </div>
    );
};
