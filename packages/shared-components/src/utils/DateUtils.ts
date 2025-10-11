/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

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
