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

// Polyfill for TextDecoder.

const REPLACEMENT_CHAR = '\uFFFD';

export default class TextDecoder {
    /**
     * Decode a UTF-8 byte array as a javascript string
     *
     * @param {Uint8Array} u8Array UTF-8-encoded onput
     * @return {str}
     */
    decode(u8Array) {
        let u0, u1, u2, u3;

        let str = '';
        let idx = 0;
        while (idx < u8Array.length) {
            u0 = u8Array[idx++];
            if (!(u0 & 0x80)) {
                str += String.fromCharCode(u0);
                continue;
            }

            if ((u0 & 0xC0) != 0xC0) {
                // continuation byte where we expect a leading byte
                str += REPLACEMENT_CHAR;
                continue;
            }

            if (u0 > 0xF4) {
                // this would imply a 5-byte or longer encoding, which is
                // invalid and unsupported here.
                str += REPLACEMENT_CHAR;
                continue;
            }

            u1 = u8Array[idx++];
            if (u1 === undefined) {
                str += REPLACEMENT_CHAR;
                continue;
            }

            if ((u1 & 0xC0) != 0x80) {
                // leading byte where we expect a continuation byte
                str += REPLACEMENT_CHAR.repeat(2);
                continue;
            }
            u1 &= 0x3F;
            if (!(u0 & 0x20)) {
                const u = ((u0 & 0x1F) << 6) | u1;
                if (u < 0x80) {
                    // over-long
                    str += REPLACEMENT_CHAR.repeat(2);
                } else {
                    str += String.fromCharCode(u);
                }
                continue;
            }

            u2 = u8Array[idx++];
            if (u2 === undefined) {
                str += REPLACEMENT_CHAR.repeat(2);
                continue;
            }
            if ((u2 & 0xC0) != 0x80) {
                // leading byte where we expect a continuation byte
                str += REPLACEMENT_CHAR.repeat(3);
                continue;
            }
            u2 &= 0x3F;
            if (!(u0 & 0x10)) {
                const u = ((u0 & 0x0F) << 12) | (u1 << 6) | u2;
                if (u < 0x800) {
                    // over-long
                    str += REPLACEMENT_CHAR.repeat(3);
                } else if (u == 0xFEFF && idx == 3) {
                    // byte-order mark: do not add to output
                } else {
                    str += String.fromCharCode(u);
                }
                continue;
            }

            u3 = u8Array[idx++];
            if (u3 === undefined) {
                str += REPLACEMENT_CHAR.repeat(3);
                continue;
            }
            if ((u3 & 0xC0) != 0x80) {
                // leading byte where we expect a continuation byte
                str += REPLACEMENT_CHAR.repeat(4);
                continue;
            }
            u3 &= 0x3F;
            const u = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
            if (u < 0x10000) {
                // over-long
                str += REPLACEMENT_CHAR.repeat(4);
                continue;
            }
            if (u > 0x1FFFF) {
                // unicode stops here.
                str += REPLACEMENT_CHAR.repeat(4);
                continue;
            }

            // encode as utf-16
            const v = u - 0x10000;
            str += String.fromCharCode(0xD800 | (v >> 10), 0xDC00 | (v & 0x3FF));
        }
        return str;
    }
}
