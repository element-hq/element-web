/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { SAS } from "@matrix-org/olm";

import {
    RendezvousError,
    RendezvousCode,
    RendezvousIntent,
    RendezvousChannel,
    RendezvousTransportDetails,
    RendezvousTransport,
    RendezvousFailureReason,
} from "..";
import { encodeUnpaddedBase64, decodeBase64 } from "../../crypto/olmlib";
import { crypto, subtleCrypto, TextEncoder } from "../../crypto/crypto";
import { generateDecimalSas } from "../../crypto/verification/SASDecimal";
import { UnstableValue } from "../../NamespacedValue";

const ECDH_V2 = new UnstableValue(
    "m.rendezvous.v2.curve25519-aes-sha256",
    "org.matrix.msc3903.rendezvous.v2.curve25519-aes-sha256",
);

export interface ECDHv2RendezvousCode extends RendezvousCode {
    rendezvous: {
        transport: RendezvousTransportDetails;
        algorithm: typeof ECDH_V2.name | typeof ECDH_V2.altName;
        key: string;
    };
}

export type MSC3903ECDHPayload = PlainTextPayload | EncryptedPayload;

export interface PlainTextPayload {
    algorithm: typeof ECDH_V2.name | typeof ECDH_V2.altName;
    key?: string;
}

export interface EncryptedPayload {
    iv: string;
    ciphertext: string;
}

async function importKey(key: Uint8Array): Promise<CryptoKey> {
    if (!subtleCrypto) {
        throw new Error("Web Crypto is not available");
    }

    const imported = subtleCrypto.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

    return imported;
}

/**
 * Implementation of the unstable [MSC3903](https://github.com/matrix-org/matrix-spec-proposals/pull/3903)
 * X25519/ECDH key agreement based secure rendezvous channel.
 * Note that this is UNSTABLE and may have breaking changes without notice.
 */
export class MSC3903ECDHv2RendezvousChannel<T> implements RendezvousChannel<T> {
    private olmSAS?: SAS;
    private ourPublicKey: Uint8Array;
    private aesKey?: CryptoKey;
    private connected = false;

    public constructor(
        private transport: RendezvousTransport<MSC3903ECDHPayload>,
        private theirPublicKey?: Uint8Array,
        public onFailure?: (reason: RendezvousFailureReason) => void,
    ) {
        this.olmSAS = new global.Olm.SAS();
        this.ourPublicKey = decodeBase64(this.olmSAS.get_pubkey());
    }

    public async generateCode(intent: RendezvousIntent): Promise<ECDHv2RendezvousCode> {
        if (this.transport.ready) {
            throw new Error("Code already generated");
        }

        await this.transport.send({ algorithm: ECDH_V2.name });

        const rendezvous: ECDHv2RendezvousCode = {
            rendezvous: {
                algorithm: ECDH_V2.name,
                key: encodeUnpaddedBase64(this.ourPublicKey),
                transport: await this.transport.details(),
            },
            intent,
        };

        return rendezvous;
    }

    public async connect(): Promise<string> {
        if (this.connected) {
            throw new Error("Channel already connected");
        }

        if (!this.olmSAS) {
            throw new Error("Channel closed");
        }

        const isInitiator = !this.theirPublicKey;

        if (isInitiator) {
            // wait for the other side to send us their public key
            const rawRes = await this.transport.receive();
            if (!rawRes) {
                throw new Error("No response from other device");
            }
            const res = rawRes as Partial<PlainTextPayload>;
            const { key, algorithm } = res;
            if (!algorithm || !ECDH_V2.matches(algorithm) || !key) {
                throw new RendezvousError(
                    "Unsupported algorithm: " + algorithm,
                    RendezvousFailureReason.UnsupportedAlgorithm,
                );
            }

            this.theirPublicKey = decodeBase64(key);
        } else {
            // send our public key unencrypted
            await this.transport.send({
                algorithm: ECDH_V2.name,
                key: encodeUnpaddedBase64(this.ourPublicKey),
            });
        }

        this.connected = true;

        this.olmSAS.set_their_key(encodeUnpaddedBase64(this.theirPublicKey!));

        const initiatorKey = isInitiator ? this.ourPublicKey : this.theirPublicKey!;
        const recipientKey = isInitiator ? this.theirPublicKey! : this.ourPublicKey;
        let aesInfo = ECDH_V2.name;
        aesInfo += `|${encodeUnpaddedBase64(initiatorKey)}`;
        aesInfo += `|${encodeUnpaddedBase64(recipientKey)}`;

        const aesKeyBytes = this.olmSAS.generate_bytes(aesInfo, 32);

        this.aesKey = await importKey(aesKeyBytes);

        // blank the bytes out to make sure not kept in memory
        aesKeyBytes.fill(0);

        const rawChecksum = this.olmSAS.generate_bytes(aesInfo, 5);
        return generateDecimalSas(Array.from(rawChecksum)).join("-");
    }

    private async encrypt(data: T): Promise<MSC3903ECDHPayload> {
        if (!subtleCrypto) {
            throw new Error("Web Crypto is not available");
        }

        const iv = new Uint8Array(32);
        crypto.getRandomValues(iv);

        const encodedData = new TextEncoder().encode(JSON.stringify(data));

        const ciphertext = await subtleCrypto.encrypt(
            {
                name: "AES-GCM",
                iv,
                tagLength: 128,
            },
            this.aesKey as CryptoKey,
            encodedData,
        );

        return {
            iv: encodeUnpaddedBase64(iv),
            ciphertext: encodeUnpaddedBase64(ciphertext),
        };
    }

    public async send(payload: T): Promise<void> {
        if (!this.olmSAS) {
            throw new Error("Channel closed");
        }

        if (!this.aesKey) {
            throw new Error("Shared secret not set up");
        }

        return this.transport.send(await this.encrypt(payload));
    }

    private async decrypt({ iv, ciphertext }: EncryptedPayload): Promise<Partial<T>> {
        if (!ciphertext || !iv) {
            throw new Error("Missing ciphertext and/or iv");
        }

        const ciphertextBytes = decodeBase64(ciphertext);

        if (!subtleCrypto) {
            throw new Error("Web Crypto is not available");
        }

        const plaintext = await subtleCrypto.decrypt(
            {
                name: "AES-GCM",
                iv: decodeBase64(iv),
                tagLength: 128,
            },
            this.aesKey as CryptoKey,
            ciphertextBytes,
        );

        return JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext)));
    }

    public async receive(): Promise<Partial<T> | undefined> {
        if (!this.olmSAS) {
            throw new Error("Channel closed");
        }
        if (!this.aesKey) {
            throw new Error("Shared secret not set up");
        }

        const rawData = await this.transport.receive();
        if (!rawData) {
            return undefined;
        }
        const data = rawData as Partial<EncryptedPayload>;
        if (data.ciphertext && data.iv) {
            return this.decrypt(data as EncryptedPayload);
        }

        throw new Error("Data received but no ciphertext");
    }

    public async close(): Promise<void> {
        if (this.olmSAS) {
            this.olmSAS.free();
            this.olmSAS = undefined;
        }
    }

    public async cancel(reason: RendezvousFailureReason): Promise<void> {
        try {
            await this.transport.cancel(reason);
        } finally {
            await this.close();
        }
    }
}
