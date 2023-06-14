/*
Copyright 2018 New Vector Ltd

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

import * as bs58 from "bs58";

// picked arbitrarily but to try & avoid clashing with any bitcoin ones
// (which are also base58 encoded, but bitcoin's involve a lot more hashing)
const OLM_RECOVERY_KEY_PREFIX = [0x8b, 0x01];

export function encodeRecoveryKey(key: ArrayLike<number>): string | undefined {
    const buf = Buffer.alloc(OLM_RECOVERY_KEY_PREFIX.length + key.length + 1);
    buf.set(OLM_RECOVERY_KEY_PREFIX, 0);
    buf.set(key, OLM_RECOVERY_KEY_PREFIX.length);

    let parity = 0;
    for (let i = 0; i < buf.length - 1; ++i) {
        parity ^= buf[i];
    }
    buf[buf.length - 1] = parity;
    const base58key = bs58.encode(buf);

    return base58key.match(/.{1,4}/g)?.join(" ");
}

export function decodeRecoveryKey(recoveryKey: string): Uint8Array {
    const result = bs58.decode(recoveryKey.replace(/ /g, ""));

    let parity = 0;
    for (const b of result) {
        parity ^= b;
    }
    if (parity !== 0) {
        throw new Error("Incorrect parity");
    }

    for (let i = 0; i < OLM_RECOVERY_KEY_PREFIX.length; ++i) {
        if (result[i] !== OLM_RECOVERY_KEY_PREFIX[i]) {
            throw new Error("Incorrect prefix");
        }
    }

    if (result.length !== OLM_RECOVERY_KEY_PREFIX.length + global.Olm.PRIVATE_KEY_LENGTH + 1) {
        throw new Error("Incorrect length");
    }

    return Uint8Array.from(
        result.slice(OLM_RECOVERY_KEY_PREFIX.length, OLM_RECOVERY_KEY_PREFIX.length + global.Olm.PRIVATE_KEY_LENGTH),
    );
}
