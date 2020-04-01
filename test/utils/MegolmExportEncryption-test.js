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

import {TextEncoder} from "util";
import nodeCrypto from "crypto";
import { Crypto } from "@peculiar/webcrypto";

const webCrypto = new Crypto();

function getRandomValues(buf) {
    return nodeCrypto.randomFillSync(buf);
}

const TEST_VECTORS=[
    [
        "plain",
        "password",
        "-----BEGIN MEGOLM SESSION DATA-----\n" +
        "AXNhbHRzYWx0c2FsdHNhbHSIiIiIiIiIiIiIiIiIiIiIAAAACmIRUW2OjZ3L2l6j9h0lHlV3M2dx\n" +
        "cissyYBxjsfsAndErh065A8=\n" +
        "-----END MEGOLM SESSION DATA-----",
    ],
    [
        "Hello, World",
        "betterpassword",
        "-----BEGIN MEGOLM SESSION DATA-----\n" +
        "AW1vcmVzYWx0bW9yZXNhbHT//////////wAAAAAAAAAAAAAD6KyBpe1Niv5M5NPm4ZATsJo5nghk\n" +
        "KYu63a0YQ5DRhUWEKk7CcMkrKnAUiZny\n" +
        "-----END MEGOLM SESSION DATA-----",
    ],
    [
        "alphanumericallyalphanumericallyalphanumericallyalphanumerically",
        "SWORDFISH",
        "-----BEGIN MEGOLM SESSION DATA-----\n" +
        "AXllc3NhbHR5Z29vZG5lc3P//////////wAAAAAAAAAAAAAD6OIW+Je7gwvjd4kYrb+49gKCfExw\n" +
        "MgJBMD4mrhLkmgAngwR1pHjbWXaoGybtiAYr0moQ93GrBQsCzPbvl82rZhaXO3iH5uHo/RCEpOqp\n" +
        "Pgg29363BGR+/Ripq/VCLKGNbw==\n" +
        "-----END MEGOLM SESSION DATA-----",
    ],
    [
        "alphanumericallyalphanumericallyalphanumericallyalphanumerically",
        "passwordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpassword" +
        "passwordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpassword" +
        "passwordpasswordpasswordpasswordpasswordpasswordpasswordpasswordpassword" +
        "passwordpasswordpasswordpasswordpassword",
        "-----BEGIN MEGOLM SESSION DATA-----\n" +
        "Af//////////////////////////////////////////AAAD6IAZJy7IQ7Y0idqSw/bmpngEEVVh\n" +
        "gsH+8ptgqxw6ZVWQnohr8JsuwH9SwGtiebZuBu5smPCO+RFVWH2cQYslZijXv/BEH/txvhUrrtCd\n" +
        "bWnSXS9oymiqwUIGs08sXI33ZA==\n" +
        "-----END MEGOLM SESSION DATA-----",
    ],
];

function stringToArray(s) {
    return new TextEncoder().encode(s).buffer;
}

describe('MegolmExportEncryption', function() {
    let MegolmExportEncryption;

    beforeAll(() => {
        window.crypto = { subtle: webCrypto.subtle, getRandomValues };
        MegolmExportEncryption = require("../../src/utils/MegolmExportEncryption");
    });

    afterAll(() => {
        window.crypto = undefined;
    });

    describe('decrypt', function() {
        it('should handle missing header', function() {
            const input=stringToArray(`-----`);
            return MegolmExportEncryption.decryptMegolmKeyFile(input, '')
            .then((res) => {
                throw new Error('expected to throw');
            }, (error) => {
                expect(error.message).toEqual('Header line not found');
            });
        });

        it('should handle missing trailer', function() {
            const input=stringToArray(`-----BEGIN MEGOLM SESSION DATA-----
-----`);
            return MegolmExportEncryption.decryptMegolmKeyFile(input, '')
            .then((res) => {
                throw new Error('expected to throw');
            }, (error) => {
                expect(error.message).toEqual('Trailer line not found');
            });
        });

        it('should handle a too-short body', function() {
            const input=stringToArray(`-----BEGIN MEGOLM SESSION DATA-----
AXNhbHRzYWx0c2FsdHNhbHSIiIiIiIiIiIiIiIiIiIiIAAAACmIRUW2OjZ3L2l6j9h0lHlV3M2dx
cissyYBxjsfsAn
-----END MEGOLM SESSION DATA-----
`);
            return MegolmExportEncryption.decryptMegolmKeyFile(input, '')
            .then((res) => {
                throw new Error('expected to throw');
            }, (error) => {
                expect(error.message).toEqual('Invalid file: too short');
            });
        });

        // TODO find a subtlecrypto shim which doesn't break this test
        it.skip('should decrypt a range of inputs', function(done) {
            function next(i) {
                if (i >= TEST_VECTORS.length) {
                    done();
                    return;
                }

                const [plain, password, input] = TEST_VECTORS[i];
                return MegolmExportEncryption.decryptMegolmKeyFile(
                    stringToArray(input), password,
                ).then((decrypted) => {
                    expect(decrypted).toEqual(plain);
                    return next(i+1);
                });
            }
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
                    ciphertext, password,
                );
            }).then((plaintext) => {
                expect(plaintext).toEqual(input);
                done();
            }).catch(done);
        });
    });
});
