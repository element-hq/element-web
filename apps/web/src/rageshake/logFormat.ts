/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Kept apart from rageshake.ts so that workers can format their logs without loading the log store.

import { getCircularReplacer } from "../utils/JSON";

/** The console functions which are logged, and the level each is logged at. */
export const consoleFunctionsToLevels = {
    log: "I",
    info: "I",
    warn: "W",
    error: "E",
    debug: "D",
} as const;

/** The name of a console function which is logged. */
export type LogFunctionName = keyof typeof consoleFunctionsToLevels;

/**
 * Convert a value passed to a console function into the text written to the log.
 *
 * @param arg - the value passed to the console function.
 * @returns the text to write to the log.
 */
export function formatLogArg(arg: unknown): string {
    if (arg instanceof DOMException) {
        return arg.message + ` (${arg.name} | ${arg.code})`;
    } else if (arg instanceof Error) {
        return arg.message + (arg.stack ? `\n${arg.stack}` : "");
    } else if (typeof arg === "object") {
        return JSON.stringify(arg, getCircularReplacer());
    } else {
        // Left as-is so that joining the line handles it as it always has.
        return arg as string;
    }
}
