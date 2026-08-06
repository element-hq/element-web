/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// macOS reads the camera/microphone consent-prompt text out of the app bundle itself, for the user's
// *system* language: `Contents/Resources/<lang>.lproj/InfoPlist.strings` when that exists, otherwise
// the base `NS*UsageDescription` value in Info.plist. The renderer's runtime i18n cannot reach them,
// so they are kept as an Apple `.strings` file that Localazy translates in its own right (see the
// `ios-strings` entries in localazy.json) and electron-builder copies into the packaged `.app`.
//
// This module exists so `electron-builder.ts` can read the English source values rather than repeat
// them: one file then feeds both the base Info.plist keys and the localized bundle resources.

import * as fs from "node:fs";
import path from "node:path";

/**
 * Directory holding the `<lang>.lproj/InfoPlist.strings` files, relative to `apps/desktop`.
 * Localazy writes one folder per translated language here; the tree is copied verbatim into
 * `Contents/Resources` of the packaged `.app`.
 */
export const INFO_PLIST_STRINGS_DIR = "src/i18n/InfoPlist";

/** The `.lproj` folder holding the English source strings, which are also the Info.plist fallback. */
const SOURCE_LPROJ = "en.lproj";

/**
 * The whole `.strings` grammar, in the order it has to be tried: a comment, a quoted string, or the
 * punctuation between them. Matching comments as tokens rather than stripping them up front is what
 * keeps a commented-out entry out of the result while still allowing comment punctuation to appear
 * inside a value — whichever token starts first consumes the text.
 */
const TOKEN_PATTERN = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"((?:[^"\\]|\\.)*)"|[=;]/g;

const ESCAPES: Record<string, string> = { n: "\n", r: "\r", t: "\t" };

function unescapeStringsValue(value: string): string {
    // \Uxxxx is Apple's escape for an arbitrary code unit; anything else escaped stands for itself,
    // notably \" and \\.
    return value.replace(/\\(?:[Uu]([0-9a-fA-F]{4})|(.))/g, (_, hex?: string, char?: string) =>
        hex !== undefined ? String.fromCharCode(parseInt(hex, 16)) : (ESCAPES[char!] ?? char!),
    );
}

/**
 * Parse an Apple `.strings` file body into its key/value pairs. Comments are ignored: Localazy
 * carries them through as translator context, they are not part of the data.
 */
export function parseInfoPlistStrings(contents: string): Record<string, string> {
    const entries: Record<string, string> = {};
    let key: string | undefined;
    let value: string | undefined;

    for (const [token, quoted] of contents.matchAll(TOKEN_PATTERN)) {
        if (quoted !== undefined) {
            if (key === undefined) key = unescapeStringsValue(quoted);
            else value = unescapeStringsValue(quoted);
        } else if (token === ";" && key !== undefined && value !== undefined) {
            entries[key] = value;
            key = undefined;
            value = undefined;
        }
    }

    return entries;
}

/**
 * Read the English usage descriptions that belong in the base Info.plist. macOS falls back to these
 * per key, so a language Localazy has not translated yet still gets a valid (English) prompt.
 *
 * @param desktopDir - the `apps/desktop` directory; defaults to the working directory, which is
 *     where electron-builder resolves the rest of its relative paths from.
 */
export function readBaseUsageDescriptions(desktopDir: string = process.cwd()): Record<string, string> {
    const source = path.join(desktopDir, INFO_PLIST_STRINGS_DIR, SOURCE_LPROJ, "InfoPlist.strings");
    return parseInfoPlistStrings(fs.readFileSync(source, "utf8"));
}
