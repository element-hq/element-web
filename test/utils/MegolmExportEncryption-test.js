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

import * as MegolmExportEncryption from 'utils/MegolmExportEncryption';

import * as testUtils from '../test-utils';
import expect from 'expect';

const TEST_VECTORS=[
    [
        "plain",
        "password",
        "-----BEGIN MEGOLM SESSION DATA-----\nAXNhbHRzYWx0c2FsdHNhbHSIiIiIiIiIiIiIiIiIiIiIAAAACmIRUW2OjZ3L2l6j9h0lHlV3M2dx\ncissyYBxjsfsAndErh065A8=\n-----END MEGOLM SESSION DATA-----"
    ],
    [
        "Hello, World",
        "betterpassword",
        "-----BEGIN MEGOLM SESSION DATA-----\nAW1vcmVzYWx0bW9yZXNhbHT//////////wAAAAAAAAAAAAAD6KyBpe1Niv5M5NPm4ZATsJo5nghk\nKYu63a0YQ5DRhUWEKk7CcMkrKnAUiZny\n-----END MEGOLM SESSION DATA-----"
    ],
    [
        "alphanumericallyalphanumericallyalphanumericallyalphanumerically",
        "SWORDFISH",
        "-----BEGIN MEGOLM SESSION DATA-----\nAXllc3NhbHR5Z29vZG5lc3P//////////wAAAAAAAAAAAAAD6OIW+Je7gwvjd4kYrb+49gKCfExw\nMgJBMD4mrhLkmgAngwR1pHjbWXaoGybtiAYr0moQ93GrBQsCzPbvl82rZhaXO3iH5uHo/RCEpOqp\nPgg29363BGR+/Ripq/VCLKGNbw==\n-----END MEGOLM SESSION DATA-----"
    ],
    [
        "alphanumericallyalphanumericallyalphanumericallyalphanumerically",
        "passwordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpassword",
        "-----BEGIN MEGOLM SESSION DATA-----\nAf//////////////////////////////////////////AAAD6IAZJy7IQ7Y0idqSw/bmpngEEVVh\ngsH+8ptgqxw6ZVWQnohr8JsuwH9SwGtiebZuBu5smPCO+RFVWH2cQYslZijXv/BEH/txvhUrrtCd\nbWnSXS9oymiqwUIGs08sXI33ZA==\n-----END MEGOLM SESSION DATA-----"
    ]
]
;

function stringToArray(s) {
    return new TextEncoder().encode(s).buffer;
}

describe('MegolmExportEncryption', function() {
    before(function() {
        // if we don't have subtlecrypto, go home now
        if (!window.crypto.subtle && !window.crypto.webkitSubtle) {
            this.skip();
        }
    })

    beforeEach(function() {
        testUtils.beforeEach(this);
    });

    describe('decrypt', function() {
        it('should handle missing header', function() {
            const input=stringToArray(`-----`);
            expect(()=>{MegolmExportEncryption.decryptMegolmKeyFile(input, '')})
                .toThrow('Header line not found');
        });

        it('should handle missing trailer', function() {
            const input=stringToArray(`-----BEGIN MEGOLM SESSION DATA-----
-----`);
            expect(()=>{MegolmExportEncryption.decryptMegolmKeyFile(input, '')})
                .toThrow('Trailer line not found');
        });

        it('should handle a too-short body', function() {
            const input=stringToArray(`-----BEGIN MEGOLM SESSION DATA-----
AXNhbHRzYWx0c2FsdHNhbHSIiIiIiIiIiIiIiIiIiIiIAAAACmIRUW2OjZ3L2l6j9h0lHlV3M2dx
cissyYBxjsfsAn
-----END MEGOLM SESSION DATA-----
`);
            expect(()=>{MegolmExportEncryption.decryptMegolmKeyFile(input, '')})
                .toThrow('Invalid file: too short');
        });

        it('should decrypt a range of inputs', function(done) {
            function next(i) {
                if (i >= TEST_VECTORS.length) {
                    done();
                    return;
                }

                const [plain, password, input] = TEST_VECTORS[i];
                return MegolmExportEncryption.decryptMegolmKeyFile(
                    stringToArray(input), password
                ).then((decrypted) => {
                    expect(decrypted).toEqual(plain);
                    return next(i+1);
                })
            };
            return next(0).catch(done);
        });
    });

    describe('encrypt', function() {
        it('should round-trip', function(done) {
            const input =
                  'words words many words in plain text here'.repeat(100);

            const password = 'my super secret passphrase';

            return MegolmExportEncryption.encryptMegolmKeyFile(
                input, password, {kdf_rounds: 1000},
            ).then((ciphertext) => {
                return MegolmExportEncryption.decryptMegolmKeyFile(
                    ciphertext, password
                );
            }).then((plaintext) => {
                expect(plaintext).toEqual(input);
                done();
            }).catch(done);
        });
    });
});
