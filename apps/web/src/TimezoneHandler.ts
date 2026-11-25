/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { SettingLevel } from "./settings/SettingLevel";
import SettingsStore from "./settings/SettingsStore";

export const USER_TIMEZONE_KEY = "userTimezone";
const log = logger.getChild("TimezoneHandler");

/**
 * Get the configured timezone for the user, or undefiend if not configured.
 * @returns The user's timezone (cased correctly), or `undefined` if unset or invalid.
 */
export function getUserTimezone(): string | undefined {
    const tz = SettingsStore.getValue(USER_TIMEZONE_KEY);
    if (!tz) return undefined;
    try {
        // Intl matches zone names regardless of case, so normalise the stored value to match `supportedValuesOf`.
        return new Intl.DateTimeFormat(undefined, { timeZone: tz }).resolvedOptions().timeZone;
    } catch {
        log.warn(`User configured timezone "${tz}" is not supported. Falling back to browser default.`);
        // Not a valid timezone, so fall back to the browser default.
        return undefined;
    }
}

/**
 * Set in the settings the given timezone
 */
export function setUserTimezone(timezone: string): Promise<void> {
    return SettingsStore.setValue(USER_TIMEZONE_KEY, null, SettingLevel.DEVICE, timezone);
}

/**
 * Return all the available timezones
 */
export function getAllTimezones(): string[] {
    const timezones = new Set(Intl.supportedValuesOf("timeZone"));
    const userTz = getUserTimezone();
    if (userTz) timezones.add(userTz);
    return [...timezones];
}

/**
 * Return the current timezone in a short human readable way
 */
export function shortBrowserTimezone(): string {
    return (
        new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
            .formatToParts(new Date())
            .find((x) => x.type === "timeZoneName")?.value ?? "GMT"
    );
}
