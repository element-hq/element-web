/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Optional } from "matrix-events-sdk";

import { _t } from "./languageHandler";

function getDaysArray(): string[] {
    return [_t("Sun"), _t("Mon"), _t("Tue"), _t("Wed"), _t("Thu"), _t("Fri"), _t("Sat")];
}

function getMonthsArray(): string[] {
    return [
        _t("Jan"),
        _t("Feb"),
        _t("Mar"),
        _t("Apr"),
        _t("May"),
        _t("Jun"),
        _t("Jul"),
        _t("Aug"),
        _t("Sep"),
        _t("Oct"),
        _t("Nov"),
        _t("Dec"),
    ];
}

function pad(n: number): string {
    return (n < 10 ? "0" : "") + n;
}

function twelveHourTime(date: Date, showSeconds = false): string {
    let hours = date.getHours() % 12;
    const minutes = pad(date.getMinutes());
    const ampm = date.getHours() >= 12 ? _t("PM") : _t("AM");
    hours = hours ? hours : 12; // convert 0 -> 12
    if (showSeconds) {
        const seconds = pad(date.getSeconds());
        return `${hours}:${minutes}:${seconds}${ampm}`;
    }
    return `${hours}:${minutes}${ampm}`;
}

export function formatDate(date: Date, showTwelveHour = false): string {
    const now = new Date();
    const days = getDaysArray();
    const months = getMonthsArray();
    if (date.toDateString() === now.toDateString()) {
        return formatTime(date, showTwelveHour);
    } else if (now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000) {
        // TODO: use standard date localize function provided in counterpart
        return _t("%(weekDayName)s %(time)s", {
            weekDayName: days[date.getDay()],
            time: formatTime(date, showTwelveHour),
        });
    } else if (now.getFullYear() === date.getFullYear()) {
        // TODO: use standard date localize function provided in counterpart
        return _t("%(weekDayName)s, %(monthName)s %(day)s %(time)s", {
            weekDayName: days[date.getDay()],
            monthName: months[date.getMonth()],
            day: date.getDate(),
            time: formatTime(date, showTwelveHour),
        });
    }
    return formatFullDate(date, showTwelveHour);
}

export function formatFullDateNoTime(date: Date): string {
    const days = getDaysArray();
    const months = getMonthsArray();
    return _t("%(weekDayName)s, %(monthName)s %(day)s %(fullYear)s", {
        weekDayName: days[date.getDay()],
        monthName: months[date.getMonth()],
        day: date.getDate(),
        fullYear: date.getFullYear(),
    });
}

export function formatFullDate(date: Date, showTwelveHour = false, showSeconds = true): string {
    const days = getDaysArray();
    const months = getMonthsArray();
    return _t("%(weekDayName)s, %(monthName)s %(day)s %(fullYear)s %(time)s", {
        weekDayName: days[date.getDay()],
        monthName: months[date.getMonth()],
        day: date.getDate(),
        fullYear: date.getFullYear(),
        time: showSeconds ? formatFullTime(date, showTwelveHour) : formatTime(date, showTwelveHour),
    });
}

/**
 * Formats dates to be compatible with attributes of a `<input type="date">`. Dates
 * should be formatted like "2020-06-23" (formatted according to ISO8601)
 *
 * @param date The date to format.
 * @returns The date string in ISO8601 format ready to be used with an `<input>`
 */
export function formatDateForInput(date: Date): string {
    const year = `${date.getFullYear()}`.padStart(4, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const dateInputValue = `${year}-${month}-${day}`;
    return dateInputValue;
}

export function formatFullTime(date: Date, showTwelveHour = false): string {
    if (showTwelveHour) {
        return twelveHourTime(date, true);
    }
    return pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds());
}

export function formatTime(date: Date, showTwelveHour = false): string {
    if (showTwelveHour) {
        return twelveHourTime(date);
    }
    return pad(date.getHours()) + ":" + pad(date.getMinutes());
}

export function formatSeconds(inSeconds: number): string {
    const isNegative = inSeconds < 0;
    inSeconds = Math.abs(inSeconds);

    const hours = Math.floor(inSeconds / (60 * 60))
        .toFixed(0)
        .padStart(2, "0");
    const minutes = Math.floor((inSeconds % (60 * 60)) / 60)
        .toFixed(0)
        .padStart(2, "0");
    const seconds = Math.floor((inSeconds % (60 * 60)) % 60)
        .toFixed(0)
        .padStart(2, "0");

    let output = "";
    if (hours !== "00") output += `${hours}:`;
    output += `${minutes}:${seconds}`;

    if (isNegative) {
        output = "-" + output;
    }

    return output;
}

export function formatTimeLeft(inSeconds: number): string {
    const hours = Math.floor(inSeconds / (60 * 60)).toFixed(0);
    const minutes = Math.floor((inSeconds % (60 * 60)) / 60).toFixed(0);
    const seconds = Math.floor((inSeconds % (60 * 60)) % 60).toFixed(0);

    if (hours !== "0") {
        return _t("%(hours)sh %(minutes)sm %(seconds)ss left", {
            hours,
            minutes,
            seconds,
        });
    }

    if (minutes !== "0") {
        return _t("%(minutes)sm %(seconds)ss left", {
            minutes,
            seconds,
        });
    }

    return _t("%(seconds)ss left", {
        seconds,
    });
}

const MILLIS_IN_DAY = 86400000;
function withinPast24Hours(prevDate: Date, nextDate: Date): boolean {
    return Math.abs(prevDate.getTime() - nextDate.getTime()) <= MILLIS_IN_DAY;
}

function withinCurrentDay(prevDate: Date, nextDate: Date): boolean {
    return withinPast24Hours(prevDate, nextDate) && prevDate.getDay() === nextDate.getDay();
}

function withinCurrentYear(prevDate: Date, nextDate: Date): boolean {
    return prevDate.getFullYear() === nextDate.getFullYear();
}

export function wantsDateSeparator(prevEventDate: Optional<Date>, nextEventDate: Optional<Date>): boolean {
    if (!nextEventDate || !prevEventDate) {
        return false;
    }
    // Return early for events that are > 24h apart
    if (!withinPast24Hours(prevEventDate, nextEventDate)) {
        return true;
    }

    // Compare weekdays
    return prevEventDate.getDay() !== nextEventDate.getDay();
}

export function formatFullDateNoDay(date: Date): string {
    return _t("%(date)s at %(time)s", {
        date: date.toLocaleDateString().replace(/\//g, "-"),
        time: date.toLocaleTimeString().replace(/:/g, "-"),
    });
}

/**
 * Returns an ISO date string without textual description of the date (ie: no "Wednesday" or
 * similar)
 * @param date The date to format.
 * @returns The date string in ISO format.
 */
export function formatFullDateNoDayISO(date: Date): string {
    return date.toISOString();
}

export function formatFullDateNoDayNoTime(date: Date): string {
    return date.getFullYear() + "/" + pad(date.getMonth() + 1) + "/" + pad(date.getDate());
}

export function formatRelativeTime(date: Date, showTwelveHour = false): string {
    const now = new Date(Date.now());
    if (withinCurrentDay(date, now)) {
        return formatTime(date, showTwelveHour);
    } else {
        const months = getMonthsArray();
        let relativeDate = `${months[date.getMonth()]} ${date.getDate()}`;

        if (!withinCurrentYear(date, now)) {
            relativeDate += `, ${date.getFullYear()}`;
        }
        return relativeDate;
    }
}

const MINUTE_MS = 60000;
const HOUR_MS = MINUTE_MS * 60;
const DAY_MS = HOUR_MS * 24;

/**
 * Formats duration in ms to human readable string
 * Returns value in biggest possible unit (day, hour, min, second)
 * Rounds values up until unit threshold
 * ie. 23:13:57 -> 23h, 24:13:57 -> 1d, 44:56:56 -> 2d
 */
export function formatDuration(durationMs: number): string {
    if (durationMs >= DAY_MS) {
        return _t("%(value)sd", { value: Math.round(durationMs / DAY_MS) });
    }
    if (durationMs >= HOUR_MS) {
        return _t("%(value)sh", { value: Math.round(durationMs / HOUR_MS) });
    }
    if (durationMs >= MINUTE_MS) {
        return _t("%(value)sm", { value: Math.round(durationMs / MINUTE_MS) });
    }
    return _t("%(value)ss", { value: Math.round(durationMs / 1000) });
}

/**
 * Formats duration in ms to human readable string
 * Returns precise value down to the nearest second
 * ie. 23:13:57 -> 23h 13m 57s, 44:56:56 -> 1d 20h 56m 56s
 */
export function formatPreciseDuration(durationMs: number): string {
    const days = Math.floor(durationMs / DAY_MS);
    const hours = Math.floor((durationMs % DAY_MS) / HOUR_MS);
    const minutes = Math.floor((durationMs % HOUR_MS) / MINUTE_MS);
    const seconds = Math.floor((durationMs % MINUTE_MS) / 1000);

    if (days > 0) {
        return _t("%(days)sd %(hours)sh %(minutes)sm %(seconds)ss", { days, hours, minutes, seconds });
    }
    if (hours > 0) {
        return _t("%(hours)sh %(minutes)sm %(seconds)ss", { hours, minutes, seconds });
    }
    if (minutes > 0) {
        return _t("%(minutes)sm %(seconds)ss", { minutes, seconds });
    }
    return _t("%(value)ss", { value: seconds });
}

/**
 * Formats a timestamp to a short date
 * (eg 25/12/22 in uk locale)
 * localised by system locale
 * @param timestamp - epoch timestamp
 * @returns {string} formattedDate
 */
export const formatLocalDateShort = (timestamp: number): string =>
    new Intl.DateTimeFormat(
        undefined, // locales
        { day: "2-digit", month: "2-digit", year: "2-digit" },
    ).format(timestamp);
