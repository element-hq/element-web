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

// polyfill textencoder if necessary
import * as TextEncodingUtf8 from 'text-encoding-utf-8';
let TextEncoder = window.TextEncoder;
if (!TextEncoder) {
    TextEncoder = TextEncodingUtf8.TextEncoder;
}
let TextDecoder = window.TextDecoder;
if (!TextDecoder) {
    TextDecoder = TextEncodingUtf8.TextDecoder;
}

const subtleCrypto = window.crypto.subtle || window.crypto.webkitSubtle;

/**
 * Decrypt a megolm key file
 *
 * @param {ArrayBuffer} file
 * @param {String} password
 * @return {Promise<String>} promise for decrypted output
 */
export function decryptMegolmKeyFile(data, password) {
    const body = unpackMegolmKeyFile(data);

    // check we have a version byte
    if (body.length < 1) {
        throw new Error('Invalid file: too short');
    }

    const version = body[0];
    if (version !== 1) {
        throw new Error('Unsupported version');
    }

    const ciphertextLength = body.length-(1+16+16+4+32);
    if (body.length < 0) {
        throw new Error('Invalid file: too short');
    }

    const salt = body.subarray(1, 1+16);
    const iv = body.subarray(17, 17+16);
    const iterations = body[33] << 24 | body[34] << 16 | body[35] << 8 | body[36];
    const ciphertext = body.subarray(37, 37+ciphertextLength);
    const hmac = body.subarray(-32);

    return deriveKeys(salt, iterations, password).then((keys) => {
        const [aes_key, hmac_key] = keys;

        const toVerify = body.subarray(0, -32);
        return subtleCrypto.verify(
            {name: 'HMAC'},
            hmac_key,
            hmac,
            toVerify,
        ).then((isValid) => {
            if (!isValid) {
                throw new Error('Authentication check failed: incorrect password?');
            }

            return subtleCrypto.decrypt(
                {
                    name: "AES-CTR",
                    counter: iv,
                    length: 64,
                },
                aes_key,
                ciphertext,
            );
        });
    }).then((plaintext) => {
        return new TextDecoder().decode(new Uint8Array(plaintext));
    });
}


/**
 * Encrypt a megolm key file
 *
 * @param {String} data
 * @param {String} password
 * @param {Object=} options
 * @param {Nunber=} options.kdf_rounds Number of iterations to perform of the
 *    key-derivation function.
 * @return {Promise<ArrayBuffer>} promise for encrypted output
 */
export function encryptMegolmKeyFile(data, password, options) {
    options = options || {};
    const kdf_rounds = options.kdf_rounds || 100000;

    const salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);

    // clear bit 63 of the salt to stop us hitting the 64-bit counter boundary
    // (which would mean we wouldn't be able to decrypt on Android). The loss
    // of a single bit of salt is a price we have to pay.
    salt[9] &= 0x7f;

    const iv = new Uint8Array(16);
    window.crypto.getRandomValues(iv);

    return deriveKeys(salt, kdf_rounds, password).then((keys) => {
        const [aes_key, hmac_key] = keys;

        return subtleCrypto.encrypt(
            {
                name: "AES-CTR",
                counter: iv,
                length: 64,
            },
            aes_key,
            new TextEncoder().encode(data),
        ).then((ciphertext) => {
            const cipherArray = new Uint8Array(ciphertext);
            const bodyLength = (1+salt.length+iv.length+4+cipherArray.length+32);
            const resultBuffer = new Uint8Array(bodyLength);
            let idx = 0;
            resultBuffer[idx++] = 1; // version
            resultBuffer.set(salt, idx); idx += salt.length;
            resultBuffer.set(iv, idx); idx += iv.length;
            resultBuffer[idx++] = kdf_rounds >> 24;
            resultBuffer[idx++] = (kdf_rounds >> 16) & 0xff;
            resultBuffer[idx++] = (kdf_rounds >> 8) & 0xff;
            resultBuffer[idx++] = kdf_rounds & 0xff;
            resultBuffer.set(cipherArray, idx); idx += cipherArray.length;

            const toSign = resultBuffer.subarray(0, idx);

            return subtleCrypto.sign(
                {name: 'HMAC'},
                hmac_key,
                toSign,
            ).then((hmac) => {
                hmac = new Uint8Array(hmac);
                resultBuffer.set(hmac, idx);
                return packMegolmKeyFile(resultBuffer);
            });
        });
    });
}

/**
 * Derive the AES and HMAC-SHA-256 keys for the file
 *
 * @param {Unit8Array} salt  salt for pbkdf
 * @param {Number} iterations number of pbkdf iterations
 * @param {String} password  password
 * @return {Promise<[CryptoKey, CryptoKey]>} promise for [aes key, hmac key]
 */
function deriveKeys(salt, iterations, password) {
    return subtleCrypto.importKey(
        'raw',
        new TextEncoder().encode(password),
        {name: 'PBKDF2'},
        false,
        ['deriveBits']
    ).then((key) => {
        return subtleCrypto.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: iterations,
                hash: 'SHA-512',
            },
            key,
            512
        );
    }).then((keybits) => {
        const aes_key = keybits.slice(0, 32);
        const hmac_key = keybits.slice(32);

        const aes_prom = subtleCrypto.importKey(
            'raw',
            aes_key,
            {name: 'AES-CTR'},
            false,
            ['encrypt', 'decrypt']
        );
        const hmac_prom = subtleCrypto.importKey(
            'raw',
            hmac_key,
            {
                name: 'HMAC',
                hash: {name: 'SHA-256'},
            },
            false,
            ['sign', 'verify']
        );
        return Promise.all([aes_prom, hmac_prom]);
    });
}

const HEADER_LINE = '-----BEGIN MEGOLM SESSION DATA-----';
const TRAILER_LINE = '-----END MEGOLM SESSION DATA-----';

/**
 * Unbase64 an ascii-armoured megolm key file
 *
 * Strips the header and trailer lines, and unbase64s the content
 *
 * @param {ArrayBuffer} data  input file
 * @return {Uint8Array} unbase64ed content
 */
function unpackMegolmKeyFile(data) {
    // parse the file as a great big String. This should be safe, because there
    // should be no non-ASCII characters, and it means that we can do string
    // comparisons to find the header and footer, and feed it into window.atob.
    const fileStr = new TextDecoder().decode(new Uint8Array(data));

    // look for the start line
    let lineStart = 0;
    while (1) {
        const lineEnd = fileStr.indexOf('\n', lineStart);
        if (lineEnd < 0) {
            throw new Error('Header line not found');
        }
        const line = fileStr.slice(lineStart, lineEnd).trim();

        // start the next line after the newline
        lineStart = lineEnd+1;

        if (line === HEADER_LINE) {
            break;
        }
    }

    const dataStart = lineStart;

    // look for the end line
    while (1) {
        const lineEnd = fileStr.indexOf('\n', lineStart);
        const line = fileStr.slice(lineStart, lineEnd < 0 ? undefined : lineEnd)
              .trim();
        if (line === TRAILER_LINE) {
            break;
        }

        if (lineEnd < 0) {
            throw new Error('Trailer line not found');
        }

        // start the next line after the newline
        lineStart = lineEnd+1;
    }

    const dataEnd = lineStart;
    return decodeBase64(fileStr.slice(dataStart, dataEnd));
}

/**
 * ascii-armour a  megolm key file
 *
 * base64s the content, and adds header and trailer lines
 *
 * @param {Uint8Array} data  raw data
 * @return {ArrayBuffer} formatted file
 */
function packMegolmKeyFile(data) {
    // we split into lines before base64ing, because encodeBase64 doesn't deal
    // terribly well with large arrays.
    const LINE_LENGTH = (72 * 4 / 3);
    const nLines = Math.ceil(data.length / LINE_LENGTH);
    const lines = new Array(nLines + 3);
    lines[0] = HEADER_LINE;
    let o = 0;
    let i;
    for (i = 1; i <= nLines; i++) {
        lines[i] = encodeBase64(data.subarray(o, o+LINE_LENGTH));
        o += LINE_LENGTH;
    }
    lines[i++] = TRAILER_LINE;
    lines[i] = '';
    return (new TextEncoder().encode(lines.join('\n'))).buffer;
}

/**
 * Encode a typed array of uint8 as base64.
 * @param {Uint8Array} uint8Array The data to encode.
 * @return {string} The base64.
 */
function encodeBase64(uint8Array) {
    // Misinterpt the Uint8Array as Latin-1.
    // window.btoa expects a unicode string with codepoints in the range 0-255.
    var latin1String = String.fromCharCode.apply(null, uint8Array);
    // Use the builtin base64 encoder.
    return window.btoa(latin1String);
}

/**
 * Decode a base64 string to a typed array of uint8.
 * @param {string} base64 The base64 to decode.
 * @return {Uint8Array} The decoded data.
 */
function decodeBase64(base64) {
    // window.atob returns a unicode string with codepoints in the range 0-255.
    var latin1String = window.atob(base64);
    // Encode the string as a Uint8Array
    var uint8Array = new Uint8Array(latin1String.length);
    for (var i = 0; i < latin1String.length; i++) {
        uint8Array[i] = latin1String.charCodeAt(i);
    }
    return uint8Array;
}
