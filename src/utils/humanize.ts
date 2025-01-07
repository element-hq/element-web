/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "../languageHandler";

// These are the constants we use for when to break the text
const MILLISECONDS_RECENT = 15000;
const MILLISECONDS_1_MIN = 75000;
const MINUTES_UNDER_1_HOUR = 45;
const MINUTES_1_HOUR = 75;
const HOURS_UNDER_1_DAY = 23;
const HOURS_1_DAY = 26;

/**
 * Converts a timestamp into human-readable, translated, text.
 * @param {number} timeMillis The time in millis to compare against.
 * @returns {string} The humanized time.
 */
export function humanizeTime(timeMillis: number): string {
    const now = Date.now();
    let msAgo = now - timeMillis;
    const minutes = Math.abs(Math.ceil(msAgo / 60000));
    const hours = Math.ceil(minutes / 60);
    const days = Math.ceil(hours / 24);

    if (msAgo >= 0) {
        // Past
        if (msAgo <= MILLISECONDS_RECENT) return _t("time|few_seconds_ago");
        if (msAgo <= MILLISECONDS_1_MIN) return _t("time|about_minute_ago");
        if (minutes <= MINUTES_UNDER_1_HOUR) return _t("time|n_minutes_ago", { num: minutes });
        if (minutes <= MINUTES_1_HOUR) return _t("time|about_hour_ago");
        if (hours <= HOURS_UNDER_1_DAY) return _t("time|n_hours_ago", { num: hours });
        if (hours <= HOURS_1_DAY) return _t("time|about_day_ago");
        return _t("time|n_days_ago", { num: days });
    } else {
        // Future
        msAgo = Math.abs(msAgo);
        if (msAgo <= MILLISECONDS_RECENT) return _t("time|in_few_seconds");
        if (msAgo <= MILLISECONDS_1_MIN) return _t("time|in_about_minute");
        if (minutes <= MINUTES_UNDER_1_HOUR) return _t("time|in_n_minutes", { num: minutes });
        if (minutes <= MINUTES_1_HOUR) return _t("time|in_about_hour");
        if (hours <= HOURS_UNDER_1_DAY) return _t("time|in_n_hours", { num: hours });
        if (hours <= HOURS_1_DAY) return _t("time|in_about_day");
        return _t("time|in_n_days", { num: days });
    }
}
