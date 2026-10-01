/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SnapshotSerializer } from "vitest";

// CSS module class names from shared-components (and compound-web) are built with postcss-modules'
// default `_<class>_<hash of the stylesheet>_<line>`, so any edit to a stylesheet renames every class
// in it and churns every snapshot that renders it. Strip the hash and line, keeping `_<class>`.

// A `class="…"` attribute, as printed in DOM snapshots and in HTML string snapshots. Only class lists
// are rewritten, so text or other attributes that happen to look like a CSS module name are left alone.
const CLASS_ATTRIBUTE = /class="([^"]*)"/g;

// `_<class>_<hash>_<line>` becomes `_<class>`: drop the last two `_`-separated parts, so a `<class>` that
// itself contains `_` (`_toolbar_item_x3k2a_12`) keeps it. Only names that start with `_` and have all three
// parts are touched, so `mx_EventTile_line` and `_layoutGroup` are left alone.
function stripCssModuleHash(name: string): string {
    const parts = name.split("_");
    if (!name.startsWith("_") || parts.length < 4) return name;
    return parts.slice(0, -2).join("_");
}

function normaliseCssModuleClasses(snapshot: string): string {
    return snapshot.replace(CLASS_ATTRIBUTE, (_attribute, classList: string) => {
        const classes = classList.split(/(\s+)/).map(stripCssModuleHash);
        return `class="${classes.join("")}"`;
    });
}

// Prevent this serializer from recursively matching the same value when it calls serialize().
let isSerializing = false;

const plugin = {
    test: (value: unknown): boolean => {
        if (isSerializing) return false;
        // String snapshots, e.g. exported HTML
        if (typeof value === "string") return value.includes('class="');
        return !!globalThis.Element && (value instanceof Element || value instanceof DocumentFragment);
    },
    print: (value: unknown, serialize: (value: unknown) => string): string => {
        isSerializing = true;
        try {
            return normaliseCssModuleClasses(serialize(value));
        } finally {
            isSerializing = false;
        }
    },
} satisfies SnapshotSerializer;

export default plugin;
// Jest compatibility exports
export const test = plugin.test;
export const print = plugin.print;
