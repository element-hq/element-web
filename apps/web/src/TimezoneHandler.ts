/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { SettingLevel } from "./settings/SettingLevel";
import SettingsStore from "./settings/SettingsStore";

export const USER_TIMEZONE_KEY = "userTimezone";

/**
 * Returning `undefined` ensure that if unset the browser default will be used in `DateTimeFormat`.
 * @returns The user specified timezone or `undefined`
 */
export function getUserTimezone(): string | undefined {
    const tz = SettingsStore.getValueAt(SettingLevel.DEVICE, USER_TIMEZONE_KEY);
    return tz || undefined;
}

/**
 * Set in the settings the given timezone
 * @timezone
 */
export function setUserTimezone(timezone: string): Promise<void> {
    return SettingsStore.setValue(USER_TIMEZONE_KEY, null, SettingLevel.DEVICE, timezone);
}

/**
 * Return all the available timezones
 */
export function getAllTimezones(): string[] {
    return Intl.supportedValuesOf("timeZone");
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
