/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Optional } from "matrix-events-sdk";

import { _t, getUserLanguage } from "./languageHandler";
import { getUserTimezone } from "./TimezoneHandler";

export const MINUTE_MS = 60000;
export const HOUR_MS = MINUTE_MS * 60;
export const DAY_MS = HOUR_MS * 24;

/**
 * Returns array of 7 weekday names, from Sunday to Saturday, internationalised to the user's language.
 * @param weekday - format desired "short" | "long" | "narrow"
 */
export function getDaysArray(weekday: Intl.DateTimeFormatOptions["weekday"] = "short"): string[] {
    const sunday = 1672574400000; // 2023-01-01 12:00 UTC
    const { format } = new Intl.DateTimeFormat(getUserLanguage(), { weekday, timeZone: "UTC" });
    return [...Array(7).keys()].map((day) => format(sunday + day * DAY_MS));
}

/**
 * Returns array of 12 month names, from January to December, internationalised to the user's language.
 * @param month - format desired "numeric" | "2-digit" | "long" | "short" | "narrow"
 */
export function getMonthsArray(month: Intl.DateTimeFormatOptions["month"] = "short"): string[] {
    const { format } = new Intl.DateTimeFormat(getUserLanguage(), { month, timeZone: "UTC" });
    return [...Array(12).keys()].map((m) => format(Date.UTC(2021, m)));
}

// XXX: Ideally we could just specify `hour12: boolean` but it has issues on Chrome in the `en` locale
// https://support.google.com/chrome/thread/29828561?hl=en
export function getTwelveHourOptions(showTwelveHour: boolean): Intl.DateTimeFormatOptions {
    return {
        hourCycle: showTwelveHour ? "h12" : "h23",
    };
}

/**
 * Formats a given date to a date & time string.
 *
 * The output format depends on how far away the given date is from now.
 * Will use the browser's default time zone.
 * If the date is today it will return a time string excluding seconds. See {@formatTime}.
 * If the date is within the last 6 days it will return the name of the weekday along with the time string excluding seconds.
 * If the date is within the same year then it will return the weekday, month and day of the month along with the time string excluding seconds.
 * Otherwise, it will return a string representing the full date & time in a human friendly manner. See {@formatFullDate}.
 * @param date - date object to format
 * @param showTwelveHour - whether to use 12-hour rather than 24-hour time. Defaults to `false` (24 hour mode).
 *        Overrides the default from the locale, whether `true` or `false`.
 * @param locale - the locale string to use, in BCP 47 format, defaulting to user's selected application locale
 */
export function formatDate(date: Date, showTwelveHour = false, locale?: string): string {
    const _locale = locale ?? getUserLanguage();
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return formatTime(date, showTwelveHour, _locale);
    } else if (now.getTime() - date.getTime() < 6 * DAY_MS) {
        // Time is within the last 6 days (or in the future)
        return new Intl.DateTimeFormat(_locale, {
            ...getTwelveHourOptions(showTwelveHour),
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZone: getUserTimezone(),
        }).format(date);
    } else if (now.getFullYear() === date.getFullYear()) {
        return new Intl.DateTimeFormat(_locale, {
            ...getTwelveHourOptions(showTwelveHour),
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: getUserTimezone(),
        }).format(date);
    }
    return formatFullDate(date, showTwelveHour, false, _locale);
}

/**
 * Formats a given date to a human-friendly string with short weekday.
 * Will use the browser's default time zone.
 * @example "Thu, 17 Nov 2022" in en-GB locale
 * @param date - date object to format
 * @param locale - the locale string to use, in BCP 47 format, defaulting to user's selected application locale
 */
export function formatFullDateNoTime(date: Date, locale?: string): string {
    return new Intl.DateTimeFormat(locale ?? getUserLanguage(), {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: getUserTimezone(),
    }).format(date);
}

/**
 * Formats a given date to a date & time string, optionally including seconds.
 * Will use the browser's default time zone.
 * @example "Thu, 17 Nov 2022, 4:58:32 pm" in en-GB locale with showTwelveHour=true and showSeconds=true
 * @param date - date object to format
 * @param showTwelveHour - whether to use 12-hour rather than 24-hour time. Defaults to `false` (24 hour mode).
 *        Overrides the default from the locale, whether `true` or `false`.
 * @param showSeconds - whether to include seconds in the time portion of the string
 * @param locale - the locale string to use, in BCP 47 format, defaulting to user's selected application locale
 */
export function formatFullDate(date: Date, showTwelveHour = false, showSeconds = true, locale?: string): string {
    return new Intl.DateTimeFormat(locale ?? getUserLanguage(), {
        ...getTwelveHourOptions(showTwelveHour),
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: showSeconds ? "2-digit" : undefined,
        timeZone: getUserTimezone(),
    }).format(date);
}

/**
 * Formats dates to be compatible with attributes of a `<input type="date">`. Dates
 * should be formatted like "2020-06-23" (formatted according to ISO8601).
 *
 * @param date The date to format.
 * @returns The date string in ISO8601 format ready to be used with an `<input>`
 */
export function formatDateForInput(date: Date): string {
    const year = `${date.getFullYear()}`.padStart(4, "0");
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Formats a given date to a time string including seconds.
 * Will use the browser's default time zone.
 * @example "4:58:32 PM" in en-GB locale with showTwelveHour=true
 * @example "16:58:32" in en-GB locale with showTwelveHour=false
 * @param date - date object to format
 * @param showTwelveHour - whether to use 12-hour rather than 24-hour time. Defaults to `false` (24 hour mode).
 *        Overrides the default from the locale, whether `true` or `false`.
 * @param locale - the locale string to use, in BCP 47 format, defaulting to user's selected application locale
 */
export function formatFullTime(date: Date, showTwelveHour = false, locale?: string): string {
    return new Intl.DateTimeFormat(locale ?? getUserLanguage(), {
        ...getTwelveHourOptions(showTwelveHour),
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZone: getUserTimezone(),
    }).format(date);
}

/**
 * Formats a given date to a time string excluding seconds.
 * Will use the browser's default time zone.
 * @example "4:58 PM" in en-GB locale with showTwelveHour=true
 * @example "16:58" in en-GB locale with showTwelveHour=false
 * @param date - date object to format
 * @param showTwelveHour - whether to use 12-hour rather than 24-hour time. Defaults to `false` (24 hour mode).
 *        Overrides the default from the locale, whether `true` or `false`.
 * @param locale - the locale string to use, in BCP 47 format, defaulting to user's selected application locale
 */
export function formatTime(date: Date, showTwelveHour = false, locale?: string): string {
    return new Intl.DateTimeFormat(locale ?? getUserLanguage(), {
        ...getTwelveHourOptions(showTwelveHour),
        hour: "numeric",
        minute: "2-digit",
        timeZone: getUserTimezone(),
    }).format(date);
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
        return _t("time|hours_minutes_seconds_left", {
            hours,
            minutes,
            seconds,
        });
    }

    if (minutes !== "0") {
        return _t("time|minutes_seconds_left", {
            minutes,
            seconds,
        });
    }

    return _t("time|seconds_left", {
        seconds,
    });
}

function withinPast24Hours(prevDate: Date, nextDate: Date): boolean {
    return Math.abs(prevDate.getTime() - nextDate.getTime()) <= DAY_MS;
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
    const locale = getUserLanguage();
    return _t("time|date_at_time", {
        date: date.toLocaleDateString(locale).replace(/\//g, "-"),
        time: date.toLocaleTimeString(locale).replace(/:/g, "-"),
    });
}

/**
 * Returns an ISO date string without textual description of the date (ie: no "Wednesday" or similar)
 * @param date The date to format.
 * @returns The date string in ISO format.
 */
export function formatFullDateNoDayISO(date: Date): string {
    return date.toISOString();
}

/**
 * Formats a given date to a string.
 * Will use the browser's default time zone.
 * @example 17/11/2022 in en-GB locale
 * @param date - date object to format
 * @param locale - the locale string to use, in BCP 47 format, defaulting to user's selected application locale
 */
export function formatFullDateNoDayNoTime(date: Date, locale?: string): string {
    return new Intl.DateTimeFormat(locale ?? getUserLanguage(), {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        timeZone: getUserTimezone(),
    }).format(date);
}

export function formatRelativeTime(date: Date, showTwelveHour = false): string {
    const now = new Date();
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

/**
 * Formats duration in ms to human-readable string
 * Returns value in the biggest possible unit (day, hour, min, second)
 * Rounds values up until unit threshold
 * i.e. 23:13:57 -> 23h, 24:13:57 -> 1d, 44:56:56 -> 2d
 */
export function formatDuration(durationMs: number): string {
    if (durationMs >= DAY_MS) {
        return _t("time|short_days", { value: Math.round(durationMs / DAY_MS) });
    }
    if (durationMs >= HOUR_MS) {
        return _t("time|short_hours", { value: Math.round(durationMs / HOUR_MS) });
    }
    if (durationMs >= MINUTE_MS) {
        return _t("time|short_minutes", { value: Math.round(durationMs / MINUTE_MS) });
    }
    return _t("time|short_seconds", { value: Math.round(durationMs / 1000) });
}

/**
 * Formats duration in ms to human-readable string
 * Returns precise value down to the nearest second
 * i.e. 23:13:57 -> 23h 13m 57s, 44:56:56 -> 1d 20h 56m 56s
 */
export function formatPreciseDuration(durationMs: number): string {
    const days = Math.floor(durationMs / DAY_MS);
    const hours = Math.floor((durationMs % DAY_MS) / HOUR_MS);
    const minutes = Math.floor((durationMs % HOUR_MS) / MINUTE_MS);
    const seconds = Math.floor((durationMs % MINUTE_MS) / 1000);

    if (days > 0) {
        return _t("time|short_days_hours_minutes_seconds", { days, hours, minutes, seconds });
    }
    if (hours > 0) {
        return _t("time|short_hours_minutes_seconds", { hours, minutes, seconds });
    }
    if (minutes > 0) {
        return _t("time|short_minutes_seconds", { minutes, seconds });
    }
    return _t("time|short_seconds", { value: seconds });
}

/**
 * Formats a timestamp to a short date
 * Similar to {@formatFullDateNoDayNoTime} but with 2-digit on day, month, year.
 * @example 25/12/22 in en-GB locale
 * @param timestamp - epoch timestamp
 * @param locale - the locale string to use, in BCP 47 format, defaulting to user's selected application locale
 * @returns {string} formattedDate
 */
export const formatLocalDateShort = (timestamp: number, locale?: string): string =>
    new Intl.DateTimeFormat(locale ?? getUserLanguage(), {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        timeZone: getUserTimezone(),
    }).format(timestamp);
