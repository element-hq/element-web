/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { SourceMap, type SourceMapPayload } from "node:module";

/** A location in a served script, as it appears in a stack frame: `<url>.js:<line>:<column>`. */
const SCRIPT_LOCATION = /(https?:\/\/[^\s()]+?\.js):(\d+):(\d+)/g;

/** A stack frame naming its function, e.g. `at Object.n (<url>.js:1:234)`. */
const NAMED_FRAME = /(\bat (?:async |new )?)([\w$.<>]+) \((https?:\/\/[^\s()]+?\.js):(\d+):(\d+)\)/g;

/** How many lines before a frame to search for the definition of its function, for scripts that aren't minified. */
const MAX_DEFINITION_SEARCH_LINES = 500;

interface Script {
    lines: string[];
    map: SourceMap;
}

/**
 * Rewrites locations in a served script, e.g. in the stack traces of console logs, to the locations in the original
 * source files, using the script's source map. The function names of stack frames are restored too.
 */
export class SourceMapper {
    /** Scripts and their source maps by script URL, or null where either can't be fetched. */
    private readonly scripts = new Map<string, Promise<Script | null>>();

    /**
     * Rewrite every script location in the given text which has a source map to its original source location, and
     * the function names of stack frames to their original names. Anything else is left as it is.
     * @param text - the text to rewrite, e.g. a browser's console logs.
     * @returns the rewritten text.
     */
    public async mapLocations(text: string): Promise<string> {
        const urls = new Set(Array.from(text.matchAll(SCRIPT_LOCATION), ([, url]) => url!));
        if (urls.size === 0) return text;
        const scripts = new Map(
            await Promise.all(Array.from(urls, async (url) => [url, await this.getScript(url)] as const)),
        );

        return text
            .replace(NAMED_FRAME, (frame, prefix: string, name: string, url: string, line: string, column: string) => {
                const script = scripts.get(url);
                if (!script) return frame;
                const location = mapLocation(script, url, Number(line), Number(column));
                return `${prefix}${mapFunctionName(script, name, Number(line), Number(column))} (${location})`;
            })
            .replace(SCRIPT_LOCATION, (location, url: string, line: string, column: string) => {
                const script = scripts.get(url);
                return script ? mapLocation(script, url, Number(line), Number(column)) : location;
            });
    }

    private getScript(url: string): Promise<Script | null> {
        let script = this.scripts.get(url);
        if (!script) {
            // Webpack, like most bundlers, serves the source map for a script alongside it
            script = Promise.all([fetch(url), fetch(`${url}.map`)])
                .then(async ([code, map]) =>
                    code.ok && map.ok
                        ? {
                              lines: (await code.text()).split("\n"),
                              map: new SourceMap((await map.json()) as SourceMapPayload),
                          }
                        : null,
                )
                .catch(() => null);
            this.scripts.set(url, script);
        }
        return script;
    }
}

/** Map a 1-based location in a script to `<original source>:<line>:<column>`, or leave it be if it has no mapping. */
function mapLocation(script: Script, url: string, line: number, column: number): string {
    // Stack frames are 1-based, source map offsets 0-based
    const entry = script.map.findEntry(line - 1, column - 1);
    if (!entry || !("originalSource" in entry)) return `${url}:${line}:${column}`;
    return `${cleanSourcePath(entry.originalSource)}:${entry.originalLine + 1}:${entry.originalColumn + 1}`;
}

/**
 * Restore the original name of the function a stack frame is in. The source map only names identifiers where they
 * appear, and the frame's location is somewhere inside the function, so find where the function is defined, by
 * searching back from the frame for a definition of its (possibly minified) name, and use the name mapped there.
 *
 * Only the last part of a dotted name, e.g. `n` in `Object.n`, is the function's own name.
 */
function mapFunctionName(script: Script, name: string, line: number, column: number): string {
    const parts = name.split(".");
    const functionName = parts.at(-1)!;
    if (!/^[\w$]+$/.test(functionName)) return name;

    const definition = findDefinition(script.lines, functionName, line - 1, column - 1);
    if (!definition) return name;
    // Node returns the mapped name, although @types/node doesn't declare it
    const mappedName = (script.map.findEntry(definition.line, definition.column) as { name?: unknown }).name;
    if (typeof mappedName !== "string" || !mappedName) return name;

    parts[parts.length - 1] = mappedName;
    return parts.join(".");
}

/** Find the 0-based position of the nearest definition of the named function at or before the given position. */
function findDefinition(
    lines: string[],
    name: string,
    line: number,
    column: number,
): { line: number; column: number } | undefined {
    const n = name.replaceAll("$", "\\$");
    // The ways a bundler defines a function: declarations, assignments, methods and object properties
    const definition = new RegExp(
        [
            `\\bfunction\\*?\\s+(${n})\\s*\\(`,
            `(?<![\\w$.])(${n})\\s*=\\s*(?:async\\s*)?(?:function\\b|\\(|[\\w$]+\\s*=>)`,
            `(?<![\\w$.])(?:async\\s+)?(${n})\\s*\\([^()]*\\)\\s*\\{`,
            `(?<![\\w$.])(${n})\\s*:\\s*(?:async\\s*)?function\\b`,
        ].join("|"),
        "dg",
    );

    for (let i = line; i >= 0 && i > line - MAX_DEFINITION_SEARCH_LINES; i--) {
        const text = i === line ? lines[i]?.slice(0, column) : lines[i];
        if (!text) continue;
        const matches = Array.from(text.matchAll(definition));
        const last = matches.at(-1);
        // Whichever alternative matched, its group holds the name
        const nameIndices = last?.indices?.slice(1).find((indices) => indices !== undefined);
        if (nameIndices) return { line: i, column: nameIndices[0] };
    }
    return undefined;
}

/** Strip the bundler's scheme and project name, e.g. `webpack://element-web/./src/Foo.ts` becomes `src/Foo.ts`. */
function cleanSourcePath(source: string): string {
    return source.replace(/^webpack:\/\/[^/]*\//, "").replace(/^\.\//, "");
}
