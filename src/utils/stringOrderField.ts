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
