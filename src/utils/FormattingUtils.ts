/*
Copyright 2016 OpenMarket Ltd
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import { ReactElement, ReactNode } from "react";
import { useIdColorHash } from "@vector-im/compound-web";

import { _t, getCurrentLanguage, getUserLanguage } from "../languageHandler";
import { jsxJoin } from "./ReactUtils";
const locale = getCurrentLanguage();

// It's quite costly to instanciate `Intl.NumberFormat`, hence why we do not do
// it in every function call
const compactFormatter = new Intl.NumberFormat(locale, {
    notation: "compact",
});

/**
 * formats and rounds numbers to fit into ~3 characters, suitable for badge counts
 * e.g: 999, 10K, 99K, 1M, 10M, 99M, 1B, 10B, ...
 */
export function formatCount(count: number): string {
    return compactFormatter.format(count);
}

// It's quite costly to instanciate `Intl.NumberFormat`, hence why we do not do
// it in every function call
const formatter = new Intl.NumberFormat(locale);

/**
 * Format a count showing the whole number but making it a bit more readable.
 * e.g: 1000 => 1,000
 */
export function formatCountLong(count: number): string {
    return formatter.format(count);
}

/**
 * format a size in bytes into a human readable form
 * e.g: 1024 -> 1.00 KB
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * format a key into groups of 4 characters, for easier visual inspection
 *
 * @param {string} key key to format
 *
 * @return {string}
 */
export function formatCryptoKey(key: string): string {
    return key.match(/.{1,4}/g)!.join(" ");
}

export function getUserNameColorClass(userId: string): string {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const number = useIdColorHash(userId);
    return `mx_Username_color${number}`;
}

/**
 * Constructs a written English string representing `items`, with an optional
 * limit on the number of items included in the result. If specified and if the
 * length of `items` is greater than the limit, the string "and n others" will
 * be appended onto the result. If `items` is empty, returns the empty string.
 * If there is only one item, return it.
 * @param {string[]} items the items to construct a string from.
 * @param {number?} itemLimit the number by which to limit the list.
 * @returns {string} a string constructed by joining `items` with a comma
 * between each item, but with the last item appended as " and [lastItem]".
 */
export function formatList(items: string[], itemLimit?: number, includeCount?: boolean): string;
export function formatList(items: ReactElement[], itemLimit?: number, includeCount?: boolean): ReactElement;
export function formatList(items: ReactNode[], itemLimit?: number, includeCount?: boolean): ReactNode;
export function formatList(items: ReactNode[], itemLimit = items.length, includeCount = false): ReactNode {
    let remaining = Math.max(items.length - itemLimit, 0);
    if (items.length <= 1) {
        return items[0] ?? "";
    }

    const formatter = new Intl.ListFormat(getUserLanguage(), { style: "long", type: "conjunction" });
    if (remaining > 0) {
        if (includeCount) {
            itemLimit--;
            remaining++;
        }

        items = items.slice(0, itemLimit);
        let joinedItems: ReactNode;
        if (items.every((e) => typeof e === "string")) {
            joinedItems = items.join(", ");
        } else {
            joinedItems = jsxJoin(items, ", ");
        }

        return _t("items_and_n_others", { count: remaining }, { Items: () => joinedItems });
    }

    if (items.every((e) => typeof e === "string")) {
        return formatter.format(items as string[]);
    }

    const parts = formatter.formatToParts(items.map((_, i) => `${i}`));
    return jsxJoin(
        parts.map((part) => {
            if (part.type === "literal") return part.value;
            return items[parseInt(part.value, 10)];
        }),
    );
}
