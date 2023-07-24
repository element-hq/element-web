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

export function snakeToCamel(s: string): string {
    return s.replace(/._./g, (v) => `${v[0]}${v[2].toUpperCase()}`);
}

export class SnakedObject<T = Record<string, any>> {
    private fallbackWarnings = new Set<string>();

    public constructor(private obj: T) {}

    public get<K extends string & keyof T>(key: K, altCaseName?: string): T[K] {
        const val = this.obj[key];
        if (val !== undefined) return val;

        const fallbackKey = altCaseName ?? snakeToCamel(key);
        const fallback = this.obj[<K>fallbackKey];
        if (!!fallback && !this.fallbackWarnings.has(fallbackKey)) {
            this.fallbackWarnings.add(fallbackKey);
            console.warn(`Using deprecated camelCase config ${fallbackKey}`);
            console.warn(
                "See https://github.com/vector-im/element-web/blob/develop/docs/config.md#-deprecation-notice",
            );
        }
        return fallback;
    }

    // Make JSON.stringify() pretend that everything is fine
    public toJSON(): T {
        return this.obj;
    }
}
