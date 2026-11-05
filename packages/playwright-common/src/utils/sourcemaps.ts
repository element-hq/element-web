/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { SourceMap, type SourceMapPayload } from "node:module";

/** A location in a served script, as it appears in a stack frame: `<url>.js:<line>:<column>`. */
const SCRIPT_LOCATION = /(https?:\/\/[^\s()]+?\.js):(\d+):(\d+)/g;

/**
 * Rewrites locations in a served script, e.g. in the stack traces of console logs, to the locations in the original
 * source files, using the script's source map.
 */
export class SourceMapper {
    /** Source maps by script URL, or null where the script has none. */
    private readonly maps = new Map<string, Promise<SourceMap | null>>();

    /**
     * Rewrite every script location in the given text which has a source map to its original source location. Other
     * locations are left as they are.
     * @param text - the text to rewrite, e.g. a browser's console logs.
     * @returns the rewritten text.
     */
    public async mapLocations(text: string): Promise<string> {
        const urls = new Set(Array.from(text.matchAll(SCRIPT_LOCATION), ([, url]) => url!));
        if (urls.size === 0) return text;
        const maps = new Map(
            await Promise.all(Array.from(urls, async (url) => [url, await this.getMap(url)] as const)),
        );

        return text.replace(SCRIPT_LOCATION, (location, url: string, line: string, column: string) => {
            // Stack frames are 1-based, source map offsets 0-based
            const entry = maps.get(url)?.findEntry(Number(line) - 1, Number(column) - 1);
            if (!entry || !("originalSource" in entry)) return location;
            return `${cleanSourcePath(entry.originalSource)}:${entry.originalLine + 1}:${entry.originalColumn + 1}`;
        });
    }

    private getMap(scriptUrl: string): Promise<SourceMap | null> {
        let map = this.maps.get(scriptUrl);
        if (!map) {
            // Webpack, like most bundlers, serves the source map for a script alongside it
            map = fetch(`${scriptUrl}.map`)
                .then(async (response) =>
                    response.ok ? new SourceMap((await response.json()) as SourceMapPayload) : null,
                )
                .catch(() => null);
            this.maps.set(scriptUrl, map);
        }
        return map;
    }
}

/** Strip the bundler's scheme and project name, e.g. `webpack://element-web/./src/Foo.ts` becomes `src/Foo.ts`. */
function cleanSourcePath(source: string): string {
    return source.replace(/^webpack:\/\/[^/]*\//, "").replace(/^\.\//, "");
}
