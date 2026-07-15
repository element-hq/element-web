/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type SnapshotSerializer } from "vitest";

const REACT_USE_ID = /_r_[a-z0-9]+_/g;

function normaliseReactUseIds(snapshot: string): string {
    // React useId values can vary between runs and make snapshots flaky:
    // https://github.com/element-hq/element-web/issues/31765
    // Avoid running the regex for DOM snapshots without React useId output.
    if (!snapshot.includes("_r_")) return snapshot;

    const ids = new Map<string, string>();
    let nextId = 1;

    return snapshot.replace(REACT_USE_ID, (id) => {
        let replacement = ids.get(id);
        if (!replacement) {
            replacement = `react-use-id-${nextId++}`;
            ids.set(id, replacement);
        }
        return replacement;
    });
}

// Prevent this serializer from recursively matching the same DOM node when it calls serialize().
let isSerializingDomSnapshot = false;

export default {
    test: (value: unknown): value is Element | DocumentFragment =>
        !isSerializingDomSnapshot &&
        globalThis.Element &&
        (value instanceof Element || value instanceof DocumentFragment),
    print: (value: unknown, serialize: (value: unknown) => string): string => {
        isSerializingDomSnapshot = true;
        try {
            return normaliseReactUseIds(serialize(value));
        } finally {
            isSerializingDomSnapshot = false;
        }
    },
} satisfies SnapshotSerializer;
