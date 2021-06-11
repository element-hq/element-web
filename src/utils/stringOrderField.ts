/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { reorder } from "./arrays";

export const ALPHABET_START = 0x20;
export const ALPHABET_END = 0x7E;
export const ALPHABET = new Array(1 + ALPHABET_END - ALPHABET_START)
    .fill(undefined)
    .map((_, i) => String.fromCharCode(ALPHABET_START + i))
    .join("");

export const baseToString = (base: number, alphabet = ALPHABET): string => {
    base = Math.floor(base);
    if (base < alphabet.length) return alphabet[base];
    return baseToString(Math.floor(base / alphabet.length), alphabet) + alphabet[base % alphabet.length];
};

export const stringToBase = (str: string, alphabet = ALPHABET): number => {
    let result = 0;
    for (let i = str.length - 1, j = 0; i >= 0; i--, j++) {
        result += (str.charCodeAt(i) - alphabet.charCodeAt(0)) * (alphabet.length ** j);
    }
    return result;
};

const pad = (str: string, length: number, alphabet = ALPHABET): string => str.padEnd(length, alphabet[0]);

export const averageBetweenStrings = (a: string, b: string, alphabet = ALPHABET): string => {
    const n = Math.max(a.length, b.length);
    const aBase = stringToBase(pad(a, n, alphabet), alphabet);
    const bBase = stringToBase(pad(b, n, alphabet), alphabet);
    return baseToString((aBase + bBase) / 2, alphabet);
};

export const midPointsBetweenStrings = (a: string, b: string, count: number, alphabet = ALPHABET): string[] => {
    const n = Math.max(a.length, b.length);
    const aBase = stringToBase(pad(a, n, alphabet), alphabet);
    const bBase = stringToBase(pad(b, n, alphabet), alphabet);
    const step = (bBase - aBase) / (count + 1);
    if (step < 1) {
        return [];
    }
    return Array(count).fill(undefined).map((_, i) => baseToString(aBase + step + (i * step), alphabet));
};

interface IEntry {
    index: number;
    order: string;
}

export const reorderLexicographically = (
    orders: Array<string | undefined>,
    fromIndex: number,
    toIndex: number,
): IEntry[] => {
    if (
        fromIndex < 0 || toIndex < 0 ||
        fromIndex > orders.length || toIndex > orders.length ||
        fromIndex === toIndex
    ) {
        return [];
    }

    const ordersWithIndices: IEntry[] = orders.map((order, index) => ({ index, order }));
    const newOrder = reorder(ordersWithIndices, fromIndex, toIndex);

    const isMoveTowardsRight = toIndex > fromIndex;
    const orderToLeftUndefined = newOrder[toIndex - 1]?.order === undefined;

    let leftBoundIdx = toIndex;
    let rightBoundIdx = toIndex;

    const canDisplaceLeft = isMoveTowardsRight || orderToLeftUndefined || true; // TODO
    if (canDisplaceLeft) {
        const nextBase = newOrder[toIndex + 1]?.order !== undefined
            ? stringToBase(newOrder[toIndex + 1].order)
            : Number.MAX_VALUE;
        for (let i = toIndex - 1, j = 0; i >= 0; i--, j++) {
            if (newOrder[i]?.order !== undefined && nextBase - stringToBase(newOrder[i].order) > j) break;
            leftBoundIdx = i;
        }
    }

    const canDisplaceRight = !orderToLeftUndefined;
    // TODO check if there is enough space on the right hand side at all,
    // I guess find the last set order and then compare it to prevBase + $requiredGap
    if (canDisplaceRight) {
        const prevBase = newOrder[toIndex - 1]?.order !== undefined
            ? stringToBase(newOrder[toIndex - 1]?.order)
            : Number.MIN_VALUE;
        for (let i = toIndex + 1, j = 0; i < newOrder.length; i++, j++) {
            if (newOrder[i]?.order === undefined || stringToBase(newOrder[i].order) - prevBase > j) break; // TODO verify
            rightBoundIdx = i;
        }
    }

    const leftDiff = toIndex - leftBoundIdx;
    const rightDiff = rightBoundIdx - toIndex;

    if (orderToLeftUndefined || leftDiff < rightDiff) {
        rightBoundIdx = toIndex;
    } else {
        leftBoundIdx = toIndex;
    }

    const prevOrder = newOrder[leftBoundIdx - 1]?.order
        ?? String.fromCharCode(ALPHABET_START).repeat(5); // TODO
    const nextOrder = newOrder[rightBoundIdx + 1]?.order
        ?? String.fromCharCode(ALPHABET_END).repeat(prevOrder.length + 1); // TODO

    const changes = midPointsBetweenStrings(prevOrder, nextOrder, 1 + rightBoundIdx - leftBoundIdx);
    // TODO If we exceed maxLen then reorder EVERYTHING

    console.log("@@ test", { prevOrder, nextOrder, changes, leftBoundIdx, rightBoundIdx, orders, fromIndex, toIndex, newOrder, orderToLeftUndefined });

    return changes.map((order, i) => {
        const index = newOrder[leftBoundIdx + i].index;

        return { index, order };
    });
};
