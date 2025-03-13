/*
Copyright 2024 New Vector Ltd.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TextEncoder } from "util";
import nodeCrypto from "crypto";
import { Crypto } from "@peculiar/webcrypto";

import type * as MegolmExportEncryptionExport from "../../../src/utils/MegolmExportEncryption";

const webCrypto = new Crypto();

function getRandomValues<T extends ArrayBufferView | null>(buf: T): T {
    // @ts-ignore fussy generics
    return nodeCrypto.randomFillSync(buf);
}

const TEST_VECTORS = [
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

function stringToArray(s: string): ArrayBufferLike {
    return new TextEncoder().encode(s).buffer;
}

describe("MegolmExportEncryption", function () {
    let MegolmExportEncryption: typeof MegolmExportEncryptionExport;

    beforeEach(() => {
        Object.defineProperty(window, "crypto", {
            value: {
                getRandomValues,
                randomUUID: jest.fn().mockReturnValue("not-random-uuid"),
                subtle: webCrypto.subtle,
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        MegolmExportEncryption = require("../../../src/utils/MegolmExportEncryption");
    });

    describe("decrypt", function () {
        it("should handle missing header", function () {
            const input = stringToArray(`-----`);
            return MegolmExportEncryption.decryptMegolmKeyFile(input, "").then(
                (res) => {
                    throw new Error("expected to throw");
                },
                (error) => {
                    expect(error.message).toEqual("Header line not found");
                },
            );
        });

        it("should handle missing trailer", function () {
            const input = stringToArray(`-----BEGIN MEGOLM SESSION DATA-----
-----`);
            return MegolmExportEncryption.decryptMegolmKeyFile(input, "").then(
                (res) => {
                    throw new Error("expected to throw");
                },
                (error) => {
                    expect(error.message).toEqual("Trailer line not found");
                },
            );
        });

        it("should handle a too-short body", function () {
            const input = stringToArray(`-----BEGIN MEGOLM SESSION DATA-----
AXNhbHRzYWx0c2FsdHNhbHSIiIiIiIiIiIiIiIiIiIiIAAAACmIRUW2OjZ3L2l6j9h0lHlV3M2dx
cissyYBxjsfsAn
-----END MEGOLM SESSION DATA-----
`);
            return MegolmExportEncryption.decryptMegolmKeyFile(input, "").then(
                (res) => {
                    throw new Error("expected to throw");
                },
                (error) => {
                    expect(error.message).toEqual("Invalid file: too short");
                },
            );
        });

        // TODO find a subtlecrypto shim which doesn't break this test
        it.skip("should decrypt a range of inputs", function () {
            function next(i: number): Promise<string | undefined> | undefined {
                if (i >= TEST_VECTORS.length) {
                    return;
                }

                const [plain, password, input] = TEST_VECTORS[i];
                return MegolmExportEncryption.decryptMegolmKeyFile(stringToArray(input), password).then((decrypted) => {
                    expect(decrypted).toEqual(plain);
                    return next(i + 1);
                });
            }
            next(0);
        });
    });

    describe("encrypt", function () {
        it("should round-trip", function () {
            const input = "words words many words in plain text here".repeat(100);

            const password = "my super secret passphrase";

            return MegolmExportEncryption.encryptMegolmKeyFile(input, password, { kdf_rounds: 1000 })
                .then((ciphertext) => {
                    return MegolmExportEncryption.decryptMegolmKeyFile(ciphertext, password);
                })
                .then((plaintext) => {
                    expect(plaintext).toEqual(input);
                });
        });
    });
});
