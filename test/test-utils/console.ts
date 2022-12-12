/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

type FilteredConsole = Pick<Console, "log" | "error" | "info" | "debug" | "warn">;

const originalFunctions: FilteredConsole = {
    log: console.log,
    error: console.error,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
};

/**
 * Allows to filter out specific messages in console.*.
 *
 * @param ignoreList Messages to be filtered
 * @returns function to restore the console
 */
export const filterConsole = (...ignoreList: string[]): (() => void) => {
    for (const [key, originalFunction] of Object.entries(originalFunctions)) {
        window.console[key as keyof FilteredConsole] = (...data: any[]) => {
            const message = data?.[0]?.message || data?.[0];

            if (typeof message === "string" && ignoreList.some((i) => message.includes(i))) {
                return;
            }

            originalFunction(...data);
        };
    }

    return () => {
        for (const [key, originalFunction] of Object.entries(originalFunctions)) {
            window.console[key as keyof FilteredConsole] = originalFunction;
        }
    };
};
