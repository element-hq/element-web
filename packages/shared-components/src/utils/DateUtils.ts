/*
 * Copyright 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns array of 7 weekday names, from Sunday to Saturday, internationalised to the given locale.
 * @param weekday - format desired "long" | "short" | "narrow"
 * @param locale - the locale string to use, defaults to "en"
 */
export function getDaysArray(weekday: Intl.DateTimeFormatOptions["weekday"] = "short", locale = "en"): string[] {
    const sunday = 1672574400000; // 2023-01-01 12:00 UTC
    const { format } = new Intl.DateTimeFormat(locale, { weekday, timeZone: "UTC" });
    return [...Array(7).keys()].map((day) => format(sunday + day * DAY_MS));
}

/**
 * Formats a given date to a human-friendly string with short weekday.
 * @example "Thu, 17 Nov 2022" in en-GB locale
 * @param date - date object to format
 * @param locale - the locale string to use, defaults to "en"
 */
export function formatFullDateNoTime(date: Date, locale = "en"): string {
    return new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

/**
 * Formats a number of seconds into a human-readable string.
 * @param inSeconds
 */
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
