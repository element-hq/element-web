/*
Copyright 2017 Vector Creations Ltd

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

"use strict";

// Polyfill for TextEncoder. Based on emscripten's stringToUTF8Array.

function utf8len(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 0xD800 && u <= 0xDFFF && i < str.length-1) {
            // lead surrogate - combine with next surrogate
            u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
        }

        if (u <= 0x7F) {
            ++len;
        } else if (u <= 0x7FF) {
            len += 2;
        } else if (u <= 0xFFFF) {
            len += 3;
        } else {
            len += 4;
        }
    }
    return len;
}

export default class TextEncoder {
    /**
     * Encode a javascript string as utf-8
     *
     * @param {String} str String to encode
     * @return {Uint8Array} UTF-8-encoded output
     */
    encode(str) {
        const outU8Array = new Uint8Array(utf8len(str));
        var outIdx = 0;
        for (var i = 0; i < str.length; ++i) {
            var u = str.charCodeAt(i);
            if (u >= 0xD800 && u <= 0xDFFF && i < str.length-1) {
                // lead surrogate - combine with next surrogate
                u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
            }

            if (u <= 0x7F) {
                outU8Array[outIdx++] = u;
            } else if (u <= 0x7FF) {
                outU8Array[outIdx++] = 0xC0 | (u >> 6);
                outU8Array[outIdx++] = 0x80 | (u & 0x3F);
            } else if (u <= 0xFFFF) {
                outU8Array[outIdx++] = 0xE0 | (u >> 12);
                outU8Array[outIdx++] = 0x80 | ((u >> 6) & 0x3F);
                outU8Array[outIdx++] = 0x80 | (u & 0x3F);
            } else {
                outU8Array[outIdx++] = 0xF0 | (u >> 18);
                outU8Array[outIdx++] = 0x80 | ((u >> 12) & 0x3F);
                outU8Array[outIdx++] = 0x80 | ((u >> 6) & 0x3F);
                outU8Array[outIdx++] = 0x80 | (u & 0x3F);
            }
        }
        return outU8Array;
    }
}
