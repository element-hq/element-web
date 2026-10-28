/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type A2UIJsonValue } from "./A2UITypes";

/**
 * Split a JSON Pointer (RFC 6901) into its unescaped reference tokens.
 * The empty pointer and "/" both refer to the whole document.
 */
export function parseJsonPointer(pointer: string): string[] {
    if (pointer === "" || pointer === "/") return [];
    const body = pointer.startsWith("/") ? pointer.slice(1) : pointer;
    return body.split("/").map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/**
 * Join a scope pointer and a pointer relative to it.
 * Used for template children, where bindings resolve against the current list item.
 */
export function joinJsonPointer(scope: string | undefined, pointer: string): string {
    if (!scope || scope === "/") return pointer;
    if (pointer === "" || pointer === "/") return scope;
    return scope + (pointer.startsWith("/") ? pointer : `/${pointer}`);
}

/**
 * Read the value at a JSON Pointer, or undefined when any segment is missing.
 */
export function getAtJsonPointer(root: A2UIJsonValue | undefined, pointer: string): A2UIJsonValue | undefined {
    let current: A2UIJsonValue | undefined = root;
    for (const token of parseJsonPointer(pointer)) {
        if (Array.isArray(current)) {
            const index = Number(token);
            current = Number.isInteger(index) ? current[index] : undefined;
        } else if (current !== null && typeof current === "object") {
            current = current[token];
        } else {
            return undefined;
        }
        if (current === undefined) return undefined;
    }
    return current;
}

/**
 * Return a copy of `root` with `value` written at the JSON Pointer, creating intermediate objects as needed.
 * Writing `undefined` removes the key. Writing to the root pointer replaces the whole document.
 */
export function setAtJsonPointer(
    root: A2UIJsonValue | undefined,
    pointer: string,
    value: A2UIJsonValue | undefined,
): A2UIJsonValue | undefined {
    const tokens = parseJsonPointer(pointer);
    if (tokens.length === 0) return value;

    const write = (node: A2UIJsonValue | undefined, depth: number): A2UIJsonValue => {
        const token = tokens[depth];
        const isLast = depth === tokens.length - 1;

        if (Array.isArray(node)) {
            const copy = [...node];
            const index = token === "-" ? copy.length : Number(token);
            if (isLast) {
                if (value === undefined) copy.splice(index, 1);
                else copy[index] = value;
            } else {
                copy[index] = write(copy[index], depth + 1);
            }
            return copy;
        }

        const copy: { [key: string]: A2UIJsonValue } = node !== null && typeof node === "object" ? { ...node } : {};
        if (isLast) {
            if (value === undefined) delete copy[token];
            else copy[token] = value;
        } else {
            copy[token] = write(copy[token], depth + 1);
        }
        return copy;
    };

    return write(root, 0);
}
