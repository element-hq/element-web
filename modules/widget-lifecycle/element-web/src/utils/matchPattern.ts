/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Checks if string matches pattern. Pattern can end with '*' to support prefix matching.
 */
export function matchPattern(value: string, pattern: string): boolean {
    return pattern.endsWith("*") ? value.startsWith(pattern.slice(0, pattern.length - 1)) : value === pattern;
}
