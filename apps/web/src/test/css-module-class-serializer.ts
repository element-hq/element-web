/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SnapshotSerializer } from "vitest";

// CSS module class names from shared-components (and compound-web) are built with postcss-modules'
// default `_<class>_<hash of the stylesheet>_<line>`, so any edit to a stylesheet renames every class
// in it and churns every snapshot that renders it. Strip the hash and line, keeping `_<class>`.
const CSS_MODULE_CLASS = /^_([A-Za-z][\w-]*)_[a-z0-9]{1,5}_\d+$/;
const CLASS_ATTRIBUTE = /class="([^"]*)"/g;

function normaliseCssModuleClasses(snapshot: string): string {
    return snapshot.replace(CLASS_ATTRIBUTE, (_attribute, classList: string) => {
        const classes = classList.split(/(\s+)/).map((name) => name.replace(CSS_MODULE_CLASS, "_$1"));
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
