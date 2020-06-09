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

import { _t } from '../languageHandler';

/**
 * formats numbers to fit into ~3 characters, suitable for badge counts
 * e.g: 999, 9.9K, 99K, 0.9M, 9.9M, 99M, 0.9B, 9.9B
 */
export function formatCount(count: number): string {
   if (count < 1000) return count.toString();
   if (count < 10000) return (count / 1000).toFixed(1) + "K";
   if (count < 100000) return (count / 1000).toFixed(0) + "K";
   if (count < 10000000) return (count / 1000000).toFixed(1) + "M";
   if (count < 100000000) return (count / 1000000).toFixed(0) + "M";
   return (count / 1000000000).toFixed(1) + "B"; // 10B is enough for anyone, right? :S
}

/**
 * Format a count showing the whole number but making it a bit more readable.
 * e.g: 1000 => 1,000
 */
export function formatCountLong(count: number): string {
    const formatter = new Intl.NumberFormat();
    return formatter.format(count)
}

/**
 * format a size in bytes into a human readable form
 * e.g: 1024 -> 1.00 KB
 */
export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * format a key into groups of 4 characters, for easier visual inspection
 *
 * @param {string} key key to format
 *
 * @return {string}
 */
export function formatCryptoKey(key: string): string {
    return key.match(/.{1,4}/g).join(" ");
}
/**
 * calculates a numeric hash for a given string
 *
 * @param {string} str string to hash
 *
 * @return {number}
 */
export function hashCode(str: string): number {
    let hash = 0;
    let i;
    let chr;
    if (str.length === 0) {
        return hash;
    }
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return Math.abs(hash);
}

export function getUserNameColorClass(userId: string): string {
    const colorNumber = (hashCode(userId) % 8) + 1;
    return `mx_Username_color${colorNumber}`;
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
export function formatCommaSeparatedList(items: string[], itemLimit?: number): string {
    const remaining = itemLimit === undefined ? 0 : Math.max(
        items.length - itemLimit, 0,
    );
    if (items.length === 0) {
        return "";
    } else if (items.length === 1) {
        return items[0];
    } else if (remaining > 0) {
        items = items.slice(0, itemLimit);
        return _t("%(items)s and %(count)s others", { items: items.join(', '), count: remaining } );
    } else {
        const lastItem = items.pop();
        return _t("%(items)s and %(lastItem)s", { items: items.join(', '), lastItem: lastItem });
    }
}

/**
 * Formats a number into a 'minimal' badge count (9, 98, 99+).
 * @param count The number to convert
 * @returns The badge count, stringified.
 */
export function formatMinimalBadgeCount(count: number): string {
    // we specifically go from "98" to "99+"
    if (count < 99) return count.toString();
    return "99+";
}
