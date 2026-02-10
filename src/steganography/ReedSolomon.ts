/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

/**
 * Reed-Solomon error correction for steganographic payloads.
 *
 * Operates over GF(2^8) with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
 * (0x11D). This allows emoji sequences to survive minor modifications
 * (e.g., platform-specific emoji rendering quirks).
 */

/** Primitive polynomial for GF(2^8): x^8 + x^4 + x^3 + x^2 + 1 */
const PRIM_POLY = 0x11d;
const FIELD_SIZE = 256;

// Precomputed lookup tables for GF(2^8) arithmetic
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

// Initialize the GF(2^8) lookup tables
(function initGaloisField(): void {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP_TABLE[i] = x;
        LOG_TABLE[x] = i;
        x <<= 1;
        if (x >= FIELD_SIZE) {
            x ^= PRIM_POLY;
            x &= 0xff;
        }
    }
    // Extend exp table for convenience in multiplication
    for (let i = 255; i < 512; i++) {
        EXP_TABLE[i] = EXP_TABLE[i - 255];
    }
})();

/** Multiply two elements in GF(2^8). */
function gfMul(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

/** Compute the inverse of an element in GF(2^8). */
function gfInv(a: number): number {
    if (a === 0) throw new Error("Cannot invert zero in GF(2^8)");
    return EXP_TABLE[255 - LOG_TABLE[a]];
}

/** Polynomial multiplication in GF(2^8)[x]. */
function polyMul(p: Uint8Array, q: Uint8Array): Uint8Array {
    const result = new Uint8Array(p.length + q.length - 1);
    for (let i = 0; i < p.length; i++) {
        for (let j = 0; j < q.length; j++) {
            result[i + j] ^= gfMul(p[i], q[j]);
        }
    }
    return result;
}

/** Build the generator polynomial for `nsym` error correction symbols. */
function buildGenerator(nsym: number): Uint8Array {
    let g = new Uint8Array([1]);
    for (let i = 0; i < nsym; i++) {
        g = polyMul(g, new Uint8Array([1, EXP_TABLE[i]]));
    }
    return g;
}

/**
 * Encode data with Reed-Solomon error correction.
 *
 * Appends `nsym` parity symbols to the data.
 *
 * @param data - Input data bytes.
 * @param nsym - Number of error correction symbols (can correct nsym/2 errors).
 * @returns Data with parity symbols appended.
 */
export function rsEncode(data: Uint8Array, nsym: number): Uint8Array {
    const gen = buildGenerator(nsym);
    const padded = new Uint8Array(data.length + nsym);
    padded.set(data);

    // Polynomial division to get remainder (parity)
    for (let i = 0; i < data.length; i++) {
        const coef = padded[i];
        if (coef !== 0) {
            for (let j = 1; j < gen.length; j++) {
                padded[i + j] ^= gfMul(gen[j], coef);
            }
        }
    }

    // Build output: original data + parity
    const result = new Uint8Array(data.length + nsym);
    result.set(data);
    result.set(padded.subarray(data.length), data.length);
    return result;
}

/**
 * Calculate syndromes for error detection/correction.
 */
function calcSyndromes(msg: Uint8Array, nsym: number): Uint8Array {
    const synd = new Uint8Array(nsym);
    for (let i = 0; i < nsym; i++) {
        let val = 0;
        for (let j = 0; j < msg.length; j++) {
            val = gfMul(val, EXP_TABLE[i]) ^ msg[j];
        }
        synd[i] = val;
    }
    return synd;
}

/**
 * Find error locator polynomial using Berlekamp-Massey algorithm.
 */
function findErrorLocator(synd: Uint8Array, nsym: number): Uint8Array {
    let errLoc = new Uint8Array([1]);
    let oldLoc = new Uint8Array([1]);

    for (let i = 0; i < nsym; i++) {
        let delta = synd[i];
        for (let j = 1; j < errLoc.length; j++) {
            delta ^= gfMul(errLoc[errLoc.length - 1 - j], synd[i - j]);
        }

        const newOldLoc = new Uint8Array(oldLoc.length + 1);
        newOldLoc.set([0]);
        newOldLoc.set(oldLoc, 1);
        oldLoc = newOldLoc;

        if (delta !== 0) {
            if (oldLoc.length > errLoc.length) {
                const newLoc = new Uint8Array(oldLoc.length);
                for (let j = 0; j < oldLoc.length; j++) {
                    newLoc[j] = gfMul(oldLoc[j], delta);
                }
                oldLoc = new Uint8Array(errLoc.length);
                const invDelta = gfInv(delta);
                for (let j = 0; j < errLoc.length; j++) {
                    oldLoc[j] = gfMul(errLoc[j], invDelta);
                }
                errLoc = newLoc;
            }

            const scaled = new Uint8Array(oldLoc.length);
            for (let j = 0; j < oldLoc.length; j++) {
                scaled[j] = gfMul(oldLoc[j], delta);
            }

            // XOR errLoc with scaled, pad if needed
            const maxLen = Math.max(errLoc.length, scaled.length);
            const result = new Uint8Array(maxLen);
            for (let j = 0; j < maxLen; j++) {
                const a = j < errLoc.length ? errLoc[errLoc.length - 1 - j] : 0;
                const b = j < scaled.length ? scaled[scaled.length - 1 - j] : 0;
                result[maxLen - 1 - j] = a ^ b;
            }
            errLoc = result;
        }
    }

    return errLoc;
}

/**
 * Find error positions using Chien search.
 */
function findErrors(errLoc: Uint8Array, msgLen: number): number[] {
    const errs = errLoc.length - 1;
    const positions: number[] = [];

    for (let i = 0; i < msgLen; i++) {
        let val = 0;
        for (let j = 0; j < errLoc.length; j++) {
            val ^= gfMul(errLoc[j], EXP_TABLE[(j * i) % 255]);
        }
        if (val === 0) {
            positions.push(msgLen - 1 - i);
        }
    }

    if (positions.length !== errs) {
        // Too many errors to correct
        return [];
    }
    return positions;
}

/**
 * Decode a Reed-Solomon encoded message, correcting errors if possible.
 *
 * @param encoded - The encoded message (data + parity symbols).
 * @param nsym - Number of error correction symbols.
 * @returns The corrected data (without parity), or null if uncorrectable.
 */
export function rsDecode(encoded: Uint8Array, nsym: number): Uint8Array | null {
    if (encoded.length < nsym) return null;

    const syndromes = calcSyndromes(encoded, nsym);

    // Check if all syndromes are zero (no errors)
    let hasErrors = false;
    for (let i = 0; i < syndromes.length; i++) {
        if (syndromes[i] !== 0) {
            hasErrors = true;
            break;
        }
    }

    if (!hasErrors) {
        return encoded.subarray(0, encoded.length - nsym);
    }

    // Find and correct errors
    const errLoc = findErrorLocator(syndromes, nsym);
    const errPositions = findErrors(errLoc, encoded.length);

    if (errPositions.length === 0) {
        // Uncorrectable errors
        return null;
    }

    // Forney algorithm to find error values
    const corrected = new Uint8Array(encoded);
    for (const pos of errPositions) {
        if (pos >= encoded.length) return null;

        const xi = EXP_TABLE[encoded.length - 1 - pos];
        let errEval = 0;
        for (let i = 0; i < syndromes.length; i++) {
            errEval ^= gfMul(syndromes[i], EXP_TABLE[(i * (encoded.length - 1 - pos)) % 255]);
        }

        let errLocDeriv = 0;
        for (let i = 1; i < errLoc.length; i += 2) {
            errLocDeriv ^= gfMul(errLoc[errLoc.length - 1 - i], EXP_TABLE[((i) * (encoded.length - 1 - pos)) % 255]);
        }

        if (errLocDeriv === 0) return null;

        const magnitude = gfMul(errEval, gfInv(gfMul(errLocDeriv, xi)));
        corrected[pos] ^= magnitude;
    }

    // Verify correction by recalculating syndromes
    const verifySynd = calcSyndromes(corrected, nsym);
    for (let i = 0; i < verifySynd.length; i++) {
        if (verifySynd[i] !== 0) return null;
    }

    return corrected.subarray(0, corrected.length - nsym);
}

/**
 * Check if a Reed-Solomon encoded message has errors.
 */
export function rsHasErrors(encoded: Uint8Array, nsym: number): boolean {
    const syndromes = calcSyndromes(encoded, nsym);
    return syndromes.some((s) => s !== 0);
}
