/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

type StringifyReplacer = (this: any, key: string, value: any) => any;

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value#circular_references
// Injects `<$ cycle-trimmed $>` wherever it cuts a cyclical object relationship
export const getCircularReplacer = (): StringifyReplacer => {
    const seen = new WeakSet();
    return (key: string, value: any): any => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "<$ cycle-trimmed $>";
            }
            seen.add(value);
        }
        return value;
    };
};
