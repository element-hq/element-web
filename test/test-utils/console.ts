/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

type FilteredConsole = Pick<Console, "log" | "error" | "info" | "debug" | "warn">;

/**
 * Allows to filter out specific messages in console.*.
 * Call this from any describe block.
 * Automagically restores the original function by implementing an afterAll hook.
 *
 * @param ignoreList Messages to be filtered
 */
export const filterConsole = (...ignoreList: string[]): void => {
    const originalFunctions: FilteredConsole = {
        log: console.log,
        error: console.error,
        info: console.info,
        debug: console.debug,
        warn: console.warn,
    };

    beforeAll(() => {
        for (const [key, originalFunction] of Object.entries(originalFunctions)) {
            window.console[key as keyof FilteredConsole] = (...data: any[]) => {
                const message = data?.[0]?.message || data?.[0];

                if (typeof message === "string" && ignoreList.some((i) => message.includes(i))) {
                    return;
                }

                originalFunction(...data);
            };
        }
    });

    afterAll(() => {
        for (const [key, originalFunction] of Object.entries(originalFunctions)) {
            window.console[key as keyof FilteredConsole] = originalFunction;
        }
    });
};
