/*
 * Copyright 2025 Element Creations Ltd.
 * Copyright 2015-2021 The Matrix.org Foundation C.I.C.
 * Copyright 2018 Michael Telatynski <7t3chguy@gmail.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
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
 * Timeline separator component to render within a MessagePanel bearing the date of the ts given
 */
export class DateSeparator extends React.Component<Props> {
    private get relativeTimeFormat(): Intl.RelativeTimeFormat {
        return new Intl.RelativeTimeFormat(this.props.locale ?? "en", { style: "long", numeric: "auto" });
    }

    public getLabel(): string {
        try {
            const date = new Date(this.props.ts);
            const { disableRelativeTimestamps = false, locale = "en" } = this.props;

            // If relative timestamps are disabled, return the full date
            if (disableRelativeTimestamps) return formatFullDateNoTime(date, locale);

            const today = new Date();
            const yesterday = new Date();
            const days = getDaysArray("long", locale);
            yesterday.setDate(today.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
                return this.relativeTimeFormat.format(0, "day"); // Today
            } else if (date.toDateString() === yesterday.toDateString()) {
                return this.relativeTimeFormat.format(-1, "day"); // Yesterday
            } else if (today.getTime() - date.getTime() < 6 * DAY_MS) {
                return days[date.getDay()]; // Sunday-Saturday
            } else {
                return formatFullDateNoTime(date, locale);
            }
        } catch {
            return _t("common|message_timestamp_invalid");
        }
    }

    public render(): React.ReactNode {
        const label = this.getLabel();

        return (
            <div
                className={classNames(styles.dateSeparator, "mx_DateSeparator", this.props.className)}
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
    }
}
