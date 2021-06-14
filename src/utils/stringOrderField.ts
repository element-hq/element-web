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

export const baseToString = (base: bigint, alphabet = ALPHABET): string => {
    const len = BigInt(alphabet.length);
    if (base < len) return alphabet[Number(base)];
    return baseToString(base / len, alphabet) + alphabet[Number(base % len)];
};

export const stringToBase = (str: string, alphabet = ALPHABET): bigint => {
    let result = BigInt(0);
    const len = BigInt(alphabet.length);
    for (let i = str.length - 1, j = BigInt(0); i >= 0; i--, j++) {
        result += BigInt(str.charCodeAt(i) - alphabet.charCodeAt(0)) * (len ** j);
    }
    return result;
};

const pad = (str: string, length: number, alphabet = ALPHABET): string => str.padEnd(length, alphabet[0]);

export const midPointsBetweenStrings = (
    a: string,
    b: string,
    count: number,
    maxLen: number,
    alphabet = ALPHABET,
): string[] => {
    const n = Math.min(maxLen, Math.max(a.length, b.length));
    const aPadded = pad(a, n, alphabet);
    const bPadded = pad(b, n, alphabet);
    const aBase = stringToBase(aPadded, alphabet);
    const bBase = stringToBase(bPadded, alphabet);
    if (bBase - aBase - BigInt(1) < count) {
        if (n < maxLen) {
            // this recurses once at most due to the new limit of n+1
            return midPointsBetweenStrings(
                pad(aPadded, n + 1, alphabet),
                pad(bPadded, n + 1, alphabet),
                count,
                n + 1,
                alphabet,
            );
        }
        return [];
    }
    const step = (bBase - aBase) / BigInt(count + 1);
    const start = BigInt(aBase + step);
    return Array(count).fill(undefined).map((_, i) => baseToString(start + (BigInt(i) * step), alphabet));
};

interface IEntry {
    index: number;
    order: string;
}

export const reorderLexicographically = (
    orders: Array<string | undefined>,
    fromIndex: number,
    toIndex: number,
    maxLen = 50,
): IEntry[] => {
    // sanity check inputs
    if (
        fromIndex < 0 || toIndex < 0 ||
        fromIndex > orders.length || toIndex > orders.length ||
        fromIndex === toIndex
    ) {
        return [];
    }

    // zip orders with their indices to simplify later index wrangling
    const ordersWithIndices: IEntry[] = orders.map((order, index) => ({ index, order }));
    // apply the fundamental order update to the zipped array
    const newOrder = reorder(ordersWithIndices, fromIndex, toIndex);

    const orderToLeftUndefined = newOrder[toIndex - 1]?.order === undefined;

    let leftBoundIdx = toIndex;
    let rightBoundIdx = toIndex;

    let canMoveLeft = true;
    const nextBase = newOrder[toIndex + 1]?.order !== undefined
        ? stringToBase(newOrder[toIndex + 1].order)
        : BigInt(Number.MAX_VALUE);

    for (let i = toIndex - 1, j = 1; i >= 0; i--, j++) {
        if (newOrder[i]?.order !== undefined && nextBase - stringToBase(newOrder[i].order) > j) break;
        leftBoundIdx = i;
    }

    if (leftBoundIdx === 0 &&
        newOrder[0].order !== undefined &&
        nextBase - stringToBase(newOrder[0].order) < toIndex
    ) {
        canMoveLeft = false;
    }

    const canDisplaceRight = !orderToLeftUndefined;
    let canMoveRight = canDisplaceRight;
    if (canDisplaceRight) {
        const prevBase = newOrder[toIndex - 1]?.order !== undefined
            ? stringToBase(newOrder[toIndex - 1]?.order)
            : BigInt(Number.MIN_VALUE);

        for (let i = toIndex + 1, j = 1; i < newOrder.length; i++, j++) {
            if (newOrder[i]?.order === undefined || stringToBase(newOrder[i].order) - prevBase > j) break; // TODO verify
            rightBoundIdx = i;
        }

        if (rightBoundIdx === newOrder.length - 1 &&
            (newOrder[rightBoundIdx]
                ? stringToBase(newOrder[rightBoundIdx].order)
                : BigInt(Number.MAX_VALUE)) - prevBase <= (rightBoundIdx - toIndex)
        ) {
            canMoveRight = false;
        }
    }

    const leftDiff = canMoveLeft ? toIndex - leftBoundIdx : Number.MAX_SAFE_INTEGER;
    const rightDiff = canMoveRight ? rightBoundIdx - toIndex : Number.MAX_SAFE_INTEGER;

    if (orderToLeftUndefined || leftDiff < rightDiff) {
        rightBoundIdx = toIndex;
    } else {
        leftBoundIdx = toIndex;
    }

    const prevOrder = newOrder[leftBoundIdx - 1]?.order
        ?? String.fromCharCode(ALPHABET_START).repeat(5);
    const nextOrder = newOrder[rightBoundIdx + 1]?.order
        ?? String.fromCharCode(ALPHABET_END).repeat(prevOrder.length);

    const changes = midPointsBetweenStrings(prevOrder, nextOrder, 1 + rightBoundIdx - leftBoundIdx, maxLen);

    console.log("@@ test", { canMoveLeft, canMoveRight, prevOrder, nextOrder, changes, leftBoundIdx, rightBoundIdx, orders, fromIndex, toIndex, newOrder, orderToLeftUndefined, leftDiff, rightDiff });

    return changes.map((order, i) => {
        const index = newOrder[leftBoundIdx + i].index;

        return { index, order };
    });
};
