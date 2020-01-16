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

import {_t} from "../languageHandler";

/**
 * Converts a timestamp into human-readable, translated, text.
 * @param {number} timeMillis The time in millis to compare against.
 * @returns {string} The humanized time.
 */
export function humanizeTime(timeMillis) {
    // These are the constants we use for when to break the text
    const MILLISECONDS_RECENT = 15000;
    const MILLISECONDS_1_MIN = 75000;
    const MINUTES_UNDER_1_HOUR = 45;
    const MINUTES_1_HOUR = 75;
    const HOURS_UNDER_1_DAY = 23;
    const HOURS_1_DAY = 26;

    const now = (new Date()).getTime();
    let msAgo = now - timeMillis;
    const minutes = Math.abs(Math.ceil(msAgo / 60000));
    const hours = Math.ceil(minutes / 60);
    const days = Math.ceil(hours / 24);

    if (msAgo >= 0) { // Past
        if (msAgo <= MILLISECONDS_RECENT) return _t("a few seconds ago");
        if (msAgo <= MILLISECONDS_1_MIN) return _t("about a minute ago");
        if (minutes <= MINUTES_UNDER_1_HOUR) return _t("%(num)s minutes ago", {num: minutes});
        if (minutes <= MINUTES_1_HOUR) return _t("about an hour ago");
        if (hours <= HOURS_UNDER_1_DAY) return _t("%(num)s hours ago", {num: hours});
        if (hours <= HOURS_1_DAY) return _t("about a day ago");
        return _t("%(num)s days ago", {num: days});
    } else { // Future
        msAgo = Math.abs(msAgo);
        if (msAgo <= MILLISECONDS_RECENT) return _t("a few seconds from now");
        if (msAgo <= MILLISECONDS_1_MIN) return _t("about a minute from now");
        if (minutes <= MINUTES_UNDER_1_HOUR) return _t("%(num)s minutes from now", {num: minutes});
        if (minutes <= MINUTES_1_HOUR) return _t("about an hour from now");
        if (hours <= HOURS_UNDER_1_DAY) return _t("%(num)s hours from now", {num: hours});
        if (hours <= HOURS_1_DAY) return _t("about a day from now");
        return _t("%(num)s days from now", {num: days});
    }
}
