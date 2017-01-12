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

import TextEncoderPolyfill from 'utils/TextEncoderPolyfill';

import * as testUtils from '../test-utils';
import expect from 'expect';

describe('textEncoderPolyfill', function() {
    beforeEach(function() {
        testUtils.beforeEach(this);
    });

    it('should correctly encode a range of strings', function() {
        const encoder = new TextEncoderPolyfill();

        expect(encoder.encode('ABC')).toEqual(Uint8Array.of(65, 66, 67));
        expect(encoder.encode('æ')).toEqual(Uint8Array.of(0xC3, 0xA6));
        expect(encoder.encode('€')).toEqual(Uint8Array.of(0xE2, 0x82, 0xAC));

        // PILE OF POO (💩)
        expect(encoder.encode('\uD83D\uDCA9')).toEqual(Uint8Array.of(0xF0, 0x9F, 0x92, 0xA9));
    });
});
