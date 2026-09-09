/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export function snakeToCamel(s: string): string {
    return s.replace(/._./g, (v) => `${v[0]}${v[2].toUpperCase()}`);
}

export class SnakedObject<T = Record<string, any>> {
    private static fallbackWarnings = new Set<string>();

    public constructor(private obj: T) {}

    public get<K extends string & keyof T>(key: K, altCaseName?: string): T[K] {
        const val = this.obj[key];
        if (val !== undefined) return val;

        const fallbackKey = altCaseName ?? snakeToCamel(key);
        const fallback = this.obj[<K>fallbackKey];
        if (!!fallback && !SnakedObject.fallbackWarnings.has(fallbackKey)) {
            SnakedObject.fallbackWarnings.add(fallbackKey);
            console.warn(
                `Using deprecated camelCase config ${fallbackKey}\n` +
                    "See https://github.com/vector-im/element-web/blob/develop/docs/config.md#-deprecation-notice",
            );
        }
        return fallback;
    }

    // Make JSON.stringify() pretend that everything is fine
    public toJSON(): T {
        return this.obj;
    }

    /**
     * Clear our record of warnings we have emitted about using a camelCase
     * fallback. Likely only useful for tests.
     */
    public static resetFallbackWarnings() {
        SnakedObject.fallbackWarnings.clear();
    }
}
