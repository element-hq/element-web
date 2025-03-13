/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Validates that a value is
 * - a number
 * - in a provided range (inclusive)
 */
export const validateNumberInRange =
    (min: number, max: number) =>
    (value?: number): boolean => {
        return typeof value === "number" && !(isNaN(value) || min > value || value > max);
    };
