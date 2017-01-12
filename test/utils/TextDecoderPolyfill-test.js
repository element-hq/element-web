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

import TextDecoderPolyfill from 'utils/TextDecoderPolyfill';

import * as testUtils from '../test-utils';
import expect from 'expect';

describe('textDecoderPolyfill', function() {
    beforeEach(function() {
        testUtils.beforeEach(this);
    });

    it('should correctly decode a range of strings', function() {
        const decoder = new TextDecoderPolyfill();

        expect(decoder.decode(Uint8Array.of(65, 66, 67))).toEqual('ABC');
        expect(decoder.decode(Uint8Array.of(0xC3, 0xA6))).toEqual('æ');
        expect(decoder.decode(Uint8Array.of(0xE2, 0x82, 0xAC))).toEqual('€');
        expect(decoder.decode(Uint8Array.of(0xF0, 0x9F, 0x92, 0xA9))).toEqual('\uD83D\uDCA9');
    });

    it('should ignore byte-order marks', function() {
        const decoder = new TextDecoderPolyfill();
        expect(decoder.decode(Uint8Array.of(0xEF, 0xBB, 0xBF, 65)))
            .toEqual('A');
    });

    it('should not ignore byte-order marks in the middle of the array', function() {
        const decoder = new TextDecoderPolyfill();
        expect(decoder.decode(Uint8Array.of(65, 0xEF, 0xBB, 0xBF, 66)))
            .toEqual('A\uFEFFB');
    });

    it('should reject overlong encodings', function() {
        const decoder = new TextDecoderPolyfill();

        // euro, as 4 bytes
        expect(decoder.decode(Uint8Array.of(65, 0xF0, 0x82, 0x82, 0xAC, 67)))
            .toEqual('A\uFFFD\uFFFD\uFFFD\uFFFDC');
    });

    it('should reject 5 and 6-byte encodings', function() {
        const decoder = new TextDecoderPolyfill();

        expect(decoder.decode(Uint8Array.of(65, 0xF8, 0x82, 0x82, 0x82, 0x82, 67)))
            .toEqual('A\uFFFD\uFFFD\uFFFD\uFFFD\uFFFDC');
    });

    it('should reject code points beyond 0x10000', function() {
        const decoder = new TextDecoderPolyfill();

        expect(decoder.decode(Uint8Array.of(0xF4, 0xA0, 0x80, 0x80)))
            .toEqual('\uFFFD\uFFFD\uFFFD\uFFFD');
    });

    it('should cope with end-of-string', function() {
        const decoder = new TextDecoderPolyfill();

        expect(decoder.decode(Uint8Array.of(65, 0xC3)))
            .toEqual('A\uFFFD');

        expect(decoder.decode(Uint8Array.of(65, 0xE2, 0x82)))
            .toEqual('A\uFFFD\uFFFD');

        expect(decoder.decode(Uint8Array.of(65, 0xF0, 0x9F, 0x92)))
            .toEqual('A\uFFFD\uFFFD\uFFFD');
    });

});
