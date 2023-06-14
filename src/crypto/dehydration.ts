/*
Copyright 2020-2021 The Matrix.org Foundation C.I.C.

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

import anotherjson from "another-json";

import type { IDeviceKeys, IOneTimeKey } from "../@types/crypto";
import { decodeBase64, encodeBase64 } from "./olmlib";
import { IndexedDBCryptoStore } from "../crypto/store/indexeddb-crypto-store";
import { decryptAES, encryptAES } from "./aes";
import { logger } from "../logger";
import { Crypto } from "./index";
import { Method } from "../http-api";
import { SecretStorageKeyDescription } from "../secret-storage";

export interface IDehydratedDevice {
    device_id: string; // eslint-disable-line camelcase
    device_data: SecretStorageKeyDescription & {
        // eslint-disable-line camelcase
        algorithm: string;
        account: string; // pickle
    };
}

export interface IDehydratedDeviceKeyInfo {
    passphrase?: string;
}

export const DEHYDRATION_ALGORITHM = "org.matrix.msc2697.v1.olm.libolm_pickle";

const oneweek = 7 * 24 * 60 * 60 * 1000;

export class DehydrationManager {
    private inProgress = false;
    private timeoutId: any;
    private key?: Uint8Array;
    private keyInfo?: { [props: string]: any };
    private deviceDisplayName?: string;

    public constructor(private readonly crypto: Crypto) {
        this.getDehydrationKeyFromCache();
    }

    public getDehydrationKeyFromCache(): Promise<void> {
        return this.crypto.cryptoStore.doTxn("readonly", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
            this.crypto.cryptoStore.getSecretStorePrivateKey(
                txn,
                async (result) => {
                    if (result) {
                        const { key, keyInfo, deviceDisplayName, time } = result;
                        const pickleKey = Buffer.from(this.crypto.olmDevice.pickleKey);
                        const decrypted = await decryptAES(key, pickleKey, DEHYDRATION_ALGORITHM);
                        this.key = decodeBase64(decrypted);
                        this.keyInfo = keyInfo;
                        this.deviceDisplayName = deviceDisplayName;
                        const now = Date.now();
                        const delay = Math.max(1, time + oneweek - now);
                        this.timeoutId = global.setTimeout(this.dehydrateDevice.bind(this), delay);
                    }
                },
                "dehydration",
            );
        });
    }

    /** set the key, and queue periodic dehydration to the server in the background */
    public async setKeyAndQueueDehydration(
        key: Uint8Array,
        keyInfo: { [props: string]: any } = {},
        deviceDisplayName?: string,
    ): Promise<void> {
        const matches = await this.setKey(key, keyInfo, deviceDisplayName);
        if (!matches) {
            // start dehydration in the background
            this.dehydrateDevice();
        }
    }

    public async setKey(
        key: Uint8Array,
        keyInfo: { [props: string]: any } = {},
        deviceDisplayName?: string,
    ): Promise<boolean | undefined> {
        if (!key) {
            // unsetting the key -- cancel any pending dehydration task
            if (this.timeoutId) {
                global.clearTimeout(this.timeoutId);
                this.timeoutId = undefined;
            }
            // clear storage
            await this.crypto.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
                this.crypto.cryptoStore.storeSecretStorePrivateKey(txn, "dehydration", null);
            });
            this.key = undefined;
            this.keyInfo = undefined;
            return;
        }

        // Check to see if it's the same key as before.  If it's different,
        // dehydrate a new device.  If it's the same, we can keep the same
        // device.  (Assume that keyInfo and deviceDisplayName will be the
        // same if the key is the same.)
        let matches: boolean = !!this.key && key.length == this.key.length;
        for (let i = 0; matches && i < key.length; i++) {
            if (key[i] != this.key![i]) {
                matches = false;
            }
        }
        if (!matches) {
            this.key = key;
            this.keyInfo = keyInfo;
            this.deviceDisplayName = deviceDisplayName;
        }
        return matches;
    }

    /** returns the device id of the newly created dehydrated device */
    public async dehydrateDevice(): Promise<string | undefined> {
        if (this.inProgress) {
            logger.log("Dehydration already in progress -- not starting new dehydration");
            return;
        }
        this.inProgress = true;
        if (this.timeoutId) {
            global.clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        try {
            const pickleKey = Buffer.from(this.crypto.olmDevice.pickleKey);

            // update the crypto store with the timestamp
            const key = await encryptAES(encodeBase64(this.key!), pickleKey, DEHYDRATION_ALGORITHM);
            await this.crypto.cryptoStore.doTxn("readwrite", [IndexedDBCryptoStore.STORE_ACCOUNT], (txn) => {
                this.crypto.cryptoStore.storeSecretStorePrivateKey(txn, "dehydration", {
                    keyInfo: this.keyInfo,
                    key,
                    deviceDisplayName: this.deviceDisplayName!,
                    time: Date.now(),
                });
            });
            logger.log("Attempting to dehydrate device");

            logger.log("Creating account");
            // create the account and all the necessary keys
            const account = new global.Olm.Account();
            account.create();
            const e2eKeys = JSON.parse(account.identity_keys());

            const maxKeys = account.max_number_of_one_time_keys();
            // FIXME: generate in small batches?
            account.generate_one_time_keys(maxKeys / 2);
            account.generate_fallback_key();
            const otks: Record<string, string> = JSON.parse(account.one_time_keys());
            const fallbacks: Record<string, string> = JSON.parse(account.fallback_key());
            account.mark_keys_as_published();

            // dehydrate the account and store it on the server
            const pickledAccount = account.pickle(new Uint8Array(this.key!));

            const deviceData: { [props: string]: any } = {
                algorithm: DEHYDRATION_ALGORITHM,
                account: pickledAccount,
            };
            if (this.keyInfo!.passphrase) {
                deviceData.passphrase = this.keyInfo!.passphrase;
            }

            logger.log("Uploading account to server");
            // eslint-disable-next-line camelcase
            const dehydrateResult = await this.crypto.baseApis.http.authedRequest<{ device_id: string }>(
                Method.Put,
                "/dehydrated_device",
                undefined,
                {
                    device_data: deviceData,
                    initial_device_display_name: this.deviceDisplayName,
                },
                {
                    prefix: "/_matrix/client/unstable/org.matrix.msc2697.v2",
                },
            );

            // send the keys to the server
            const deviceId = dehydrateResult.device_id;
            logger.log("Preparing device keys", deviceId);
            const deviceKeys: IDeviceKeys = {
                algorithms: this.crypto.supportedAlgorithms,
                device_id: deviceId,
                user_id: this.crypto.userId,
                keys: {
                    [`ed25519:${deviceId}`]: e2eKeys.ed25519,
                    [`curve25519:${deviceId}`]: e2eKeys.curve25519,
                },
            };
            const deviceSignature = account.sign(anotherjson.stringify(deviceKeys));
            deviceKeys.signatures = {
                [this.crypto.userId]: {
                    [`ed25519:${deviceId}`]: deviceSignature,
                },
            };
            if (this.crypto.crossSigningInfo.getId("self_signing")) {
                await this.crypto.crossSigningInfo.signObject(deviceKeys, "self_signing");
            }

            logger.log("Preparing one-time keys");
            const oneTimeKeys: Record<string, IOneTimeKey> = {};
            for (const [keyId, key] of Object.entries(otks.curve25519)) {
                const k: IOneTimeKey = { key };
                const signature = account.sign(anotherjson.stringify(k));
                k.signatures = {
                    [this.crypto.userId]: {
                        [`ed25519:${deviceId}`]: signature,
                    },
                };
                oneTimeKeys[`signed_curve25519:${keyId}`] = k;
            }

            logger.log("Preparing fallback keys");
            const fallbackKeys: Record<string, IOneTimeKey> = {};
            for (const [keyId, key] of Object.entries(fallbacks.curve25519)) {
                const k: IOneTimeKey = { key, fallback: true };
                const signature = account.sign(anotherjson.stringify(k));
                k.signatures = {
                    [this.crypto.userId]: {
                        [`ed25519:${deviceId}`]: signature,
                    },
                };
                fallbackKeys[`signed_curve25519:${keyId}`] = k;
            }

            logger.log("Uploading keys to server");
            await this.crypto.baseApis.http.authedRequest(
                Method.Post,
                "/keys/upload/" + encodeURI(deviceId),
                undefined,
                {
                    "device_keys": deviceKeys,
                    "one_time_keys": oneTimeKeys,
                    "org.matrix.msc2732.fallback_keys": fallbackKeys,
                },
            );
            logger.log("Done dehydrating");

            // dehydrate again in a week
            this.timeoutId = global.setTimeout(this.dehydrateDevice.bind(this), oneweek);

            return deviceId;
        } finally {
            this.inProgress = false;
        }
    }

    public stop(): void {
        if (this.timeoutId) {
            global.clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }
}
