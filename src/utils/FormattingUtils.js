/*
Copyright 2016 OpenMarket Ltd

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

/**
 * formats numbers to fit into ~3 characters, suitable for badge counts
 * e.g: 999, 9.9K, 99K, 0.9M, 9.9M, 99M, 0.9B, 9.9B
 */
export function formatCount(count) {
   if (count < 1000) return count;
   if (count < 10000) return (count / 1000).toFixed(1) + "K";
   if (count < 100000) return (count / 1000).toFixed(0) + "K";
   if (count < 10000000) return (count / 1000000).toFixed(1) + "M";
   if (count < 100000000) return (count / 1000000).toFixed(0) + "M";
   return (count / 1000000000).toFixed(1) + "B"; // 10B is enough for anyone, right? :S
}

/**
 * format a key into groups of 4 characters, for easier visual inspection
 *
 * @param {string} key key to format
 *
 * @return {string}
 */
export function formatCryptoKey(key) {
    return key.match(/.{1,4}/g).join(" ");
}
/**
 * calculates a numeric hash for a given string
 *
 * @param {string} str string to hash
 *
 * @return {number}
 */
export function hashCode(str) {
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

export function getUserNameColorClass(userId) {
    const colorNumber = (hashCode(userId) % 8) + 1;
    return `mx_Username_color${colorNumber}`;
}
