/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Get the values for an enum.
 * @param e The enum.
 * @returns The enum values.
 */
export function getEnumValues(e: any): (string | number)[] {
    // String-based enums will simply be objects ({Key: "value"}), but number-based
    // enums will instead map themselves twice: in one direction for {Key: 12} and
    // the reverse for easy lookup, presumably ({12: Key}). In the reverse mapping,
    // the key is a string, not a number.
    //
    // For this reason, we try to determine what kind of enum we're dealing with.

    const keys = Object.keys(e);
    const values: (string | number)[] = [];
    for (const key of keys) {
        const value = e[key];
        if (Number.isFinite(value) || e[value.toString()] !== Number(key)) {
            values.push(value);
        }
    }
    return values;
}

/**
 * Determines if a given value is a valid value for the provided enum.
 * @param e The enum to check against.
 * @param val The value to search for.
 * @returns True if the enum contains the value.
 */
export function isEnumValue<T>(e: T, val: string | number): boolean {
    return getEnumValues(e).includes(val);
}
