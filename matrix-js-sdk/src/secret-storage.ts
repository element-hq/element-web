/*
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

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

/**
 * Implementation of server-side secret storage
 *
 * @see https://spec.matrix.org/v1.6/client-server-api/#storage
 */

import { TypedEventEmitter } from "./models/typed-event-emitter";
import { ClientEvent, ClientEventHandlerMap } from "./client";
import { MatrixEvent } from "./models/event";
import { calculateKeyCheck, decryptAES, encryptAES, IEncryptedPayload } from "./crypto/aes";
import { randomString } from "./randomstring";
import { logger } from "./logger";

export const SECRET_STORAGE_ALGORITHM_V1_AES = "m.secret_storage.v1.aes-hmac-sha2";

/**
 * Common base interface for Secret Storage Keys.
 *
 * The common properties for all encryption keys used in server-side secret storage.
 *
 * @see https://spec.matrix.org/v1.6/client-server-api/#key-storage
 */
export interface SecretStorageKeyDescriptionCommon {
    /** A human-readable name for this key. */
    // XXX: according to the spec, this is optional
    name: string;

    /** The encryption algorithm used with this key. */
    algorithm: string;

    /** Information for deriving this key from a passphrase. */
    // XXX: according to the spec, this is optional
    passphrase: PassphraseInfo;
}

/**
 * Properties for a SSSS key using the `m.secret_storage.v1.aes-hmac-sha2` algorithm.
 *
 * Corresponds to `AesHmacSha2KeyDescription` in the specification.
 *
 * @see https://spec.matrix.org/v1.6/client-server-api/#msecret_storagev1aes-hmac-sha2
 */
export interface SecretStorageKeyDescriptionAesV1 extends SecretStorageKeyDescriptionCommon {
    // XXX: strictly speaking, we should be able to enforce the algorithm here. But
    //   this interface ends up being incorrectly used where other algorithms are in use (notably
    //   in device-dehydration support), and unpicking that is too much like hard work
    //   at the moment.
    // algorithm: "m.secret_storage.v1.aes-hmac-sha2";

    /** The 16-byte AES initialization vector, encoded as base64. */
    iv: string;

    /** The MAC of the result of encrypting 32 bytes of 0, encoded as base64. */
    mac: string;
}

/**
 * Union type for secret storage keys.
 *
 * For now, this is only {@link SecretStorageKeyDescriptionAesV1}, but other interfaces may be added in future.
 */
export type SecretStorageKeyDescription = SecretStorageKeyDescriptionAesV1;

/**
 * Information on how to generate the key from a passphrase.
 *
 * @see https://spec.matrix.org/v1.6/client-server-api/#deriving-keys-from-passphrases
 */
export interface PassphraseInfo {
    /** The algorithm to be used to derive the key. */
    algorithm: "m.pbkdf2";

    /** The number of PBKDF2 iterations to use. */
    iterations: number;

    /** The salt to be used for PBKDF2. */
    salt: string;

    /** The number of bits to generate. Defaults to 256. */
    bits?: number;
}

/**
 * Options for {@link ServerSideSecretStorageImpl#addKey}.
 */
export interface AddSecretStorageKeyOpts {
    pubkey?: string;
    passphrase?: PassphraseInfo;
    name?: string;
    key?: Uint8Array;
}

/**
 * Return type for {@link ServerSideSecretStorageImpl#getKey}.
 */
export type SecretStorageKeyTuple = [keyId: string, keyInfo: SecretStorageKeyDescription];

/**
 * Return type for {@link ServerSideSecretStorageImpl#addKey}.
 */
export type SecretStorageKeyObject = {
    /** The ID of the key */
    keyId: string;
    /**  details about the key */
    keyInfo: SecretStorageKeyDescription;
};

/** Interface for managing account data on the server.
 *
 * A subset of {@link MatrixClient}.
 */
export interface AccountDataClient extends TypedEventEmitter<ClientEvent.AccountData, ClientEventHandlerMap> {
    /**
     * Get account data event of given type for the current user. This variant
     * gets account data directly from the homeserver if the local store is not
     * ready, which can be useful very early in startup before the initial sync.
     *
     * @param eventType - The type of account data
     * @returns The contents of the given account data event, or `null` if the event is not found
     */
    getAccountDataFromServer: <T extends Record<string, any>>(eventType: string) => Promise<T | null>;

    /**
     * Set account data event for the current user, with retries
     *
     * @param eventType - The type of account data
     * @param content - the content object to be set
     * @returns an empty object
     */
    setAccountData: (eventType: string, content: any) => Promise<{}>;
}

/**
 *  Application callbacks for use with {@link SecretStorage.ServerSideSecretStorageImpl}
 */
export interface SecretStorageCallbacks {
    /**
     * Called to retrieve a secret storage encryption key
     *
     * Before a secret can be stored in server-side storage, it must be encrypted with one or more
     * keys. Similarly, after it has been retrieved from storage, it must be decrypted with one of
     * the keys it was encrypted with. These encryption keys are known as "secret storage keys".
     *
     * Descriptions of the secret storage keys are also stored in server-side storage, per the
     * [matrix specification](https://spec.matrix.org/v1.6/client-server-api/#key-storage), so
     * before a key can be used in this way, it must have been stored on the server. This is
     * done via {@link SecretStorage.ServerSideSecretStorage#addKey}.
     *
     * Obviously the keys themselves are not stored server-side, so the js-sdk calls this callback
     * in order to retrieve a secret storage key from the application.
     *
     * @param keys - An options object, containing only the property `keys`.
     *
     * @param name - the name of the *secret* (NB: not the encryption key) being stored or retrieved.
     *    This is the "event type" stored in account data.
     *
     * @returns a pair [`keyId`, `privateKey`], where `keyId` is one of the keys from the `keys` parameter,
     *    and `privateKey` is the raw private encryption key, as appropriate for the encryption algorithm.
     *    (For `m.secret_storage.v1.aes-hmac-sha2`, it is the input to an HKDF as defined in the
     *    [specification](https://spec.matrix.org/v1.6/client-server-api/#msecret_storagev1aes-hmac-sha2).)
     *
     *    Alternatively, if none of the keys are known, may return `null` — in which case the original
     *    storage/retrieval operation will fail with an exception.
     */
    getSecretStorageKey?: (
        keys: {
            /**
             * details of the secret storage keys required: a map from the key ID
             * (excluding the `m.secret_storage.key.` prefix) to details of the key.
             *
             * When storing a secret, `keys` will contain exactly one entry; this method will be called
             * once for each secret storage key to be used for encryption.
             *
             * For secret retrieval, `keys` may contain several entries, and the application can return
             * any one of the requested keys.
             */
            keys: Record<string, SecretStorageKeyDescription>;
        },
        name: string,
    ) => Promise<[string, Uint8Array] | null>;
}

interface SecretInfo {
    encrypted: {
        [keyId: string]: IEncryptedPayload;
    };
}

interface Decryptors {
    encrypt: (plaintext: string) => Promise<IEncryptedPayload>;
    decrypt: (ciphertext: IEncryptedPayload) => Promise<string>;
}

/**
 * Interface provided by SecretStorage implementations
 *
 * Normally this will just be an {@link ServerSideSecretStorageImpl}, but for backwards
 * compatibility some methods allow other implementations.
 */
export interface ServerSideSecretStorage {
    /**
     * Add a key for encrypting secrets.
     *
     * @param algorithm - the algorithm used by the key.
     * @param opts - the options for the algorithm.  The properties used
     *     depend on the algorithm given.
     * @param keyId - the ID of the key.  If not given, a random
     *     ID will be generated.
     *
     * @returns details about the key.
     */
    addKey(algorithm: string, opts: AddSecretStorageKeyOpts, keyId?: string): Promise<SecretStorageKeyObject>;

    /**
     * Get the key information for a given ID.
     *
     * @param keyId - The ID of the key to check
     *     for. Defaults to the default key ID if not provided.
     * @returns If the key was found, the return value is an array of
     *     the form [keyId, keyInfo].  Otherwise, null is returned.
     *     XXX: why is this an array when addKey returns an object?
     */
    getKey(keyId?: string | null): Promise<SecretStorageKeyTuple | null>;

    /**
     * Check whether we have a key with a given ID.
     *
     * @param keyId - The ID of the key to check
     *     for. Defaults to the default key ID if not provided.
     * @returns Whether we have the key.
     */
    hasKey(keyId?: string): Promise<boolean>;

    /**
     * Check whether a key matches what we expect based on the key info
     *
     * @param key - the key to check
     * @param info - the key info
     *
     * @returns whether or not the key matches
     */
    checkKey(key: Uint8Array, info: SecretStorageKeyDescriptionAesV1): Promise<boolean>;

    /**
     * Store an encrypted secret on the server.
     *
     * Details of the encryption keys to be used must previously have been stored in account data
     * (for example, via {@link ServerSideSecretStorage#addKey}.
     *
     * @param name - The name of the secret - i.e., the "event type" to be stored in the account data
     * @param secret - The secret contents.
     * @param keys - The IDs of the keys to use to encrypt the secret, or null/undefined to use the default key
     *     (will throw if no default key is set).
     */
    store(name: string, secret: string, keys?: string[] | null): Promise<void>;

    /**
     * Get a secret from storage, and decrypt it.
     *
     * @param name - the name of the secret - i.e., the "event type" stored in the account data
     *
     * @returns the decrypted contents of the secret, or "undefined" if `name` is not found in
     *    the user's account data.
     */
    get(name: string): Promise<string | undefined>;

    /**
     * Check if a secret is stored on the server.
     *
     * @param name - the name of the secret
     *
     * @returns map of key name to key info the secret is encrypted
     *     with, or null if it is not present or not encrypted with a trusted
     *     key
     */
    isStored(name: string): Promise<Record<string, SecretStorageKeyDescriptionAesV1> | null>;

    /**
     * Get the current default key ID for encrypting secrets.
     *
     * @returns The default key ID or null if no default key ID is set
     */
    getDefaultKeyId(): Promise<string | null>;

    /**
     * Set the default key ID for encrypting secrets.
     *
     * @param keyId - The new default key ID
     */
    setDefaultKeyId(keyId: string): Promise<void>;
}

/**
 * Implementation of Server-side secret storage.
 *
 * Secret *sharing* is *not* implemented here: this class is strictly about the storage component of
 * SSSS.
 *
 * @see https://spec.matrix.org/v1.6/client-server-api/#storage
 */
export class ServerSideSecretStorageImpl implements ServerSideSecretStorage {
    /**
     * Construct a new `SecretStorage`.
     *
     * Normally, it is unnecessary to call this directly, since MatrixClient automatically constructs one.
     * However, it may be useful to construct a new `SecretStorage`, if custom `callbacks` are required, for example.
     *
     * @param accountDataAdapter - interface for fetching and setting account data on the server. Normally an instance
     *   of {@link MatrixClient}.
     * @param callbacks - application level callbacks for retrieving secret keys
     */
    public constructor(
        private readonly accountDataAdapter: AccountDataClient,
        private readonly callbacks: SecretStorageCallbacks,
    ) {}

    /**
     * Get the current default key ID for encrypting secrets.
     *
     * @returns The default key ID or null if no default key ID is set
     */
    public async getDefaultKeyId(): Promise<string | null> {
        const defaultKey = await this.accountDataAdapter.getAccountDataFromServer<{ key: string }>(
            "m.secret_storage.default_key",
        );
        if (!defaultKey) return null;
        return defaultKey.key;
    }

    /**
     * Set the default key ID for encrypting secrets.
     *
     * @param keyId - The new default key ID
     */
    public setDefaultKeyId(keyId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const listener = (ev: MatrixEvent): void => {
                if (ev.getType() === "m.secret_storage.default_key" && ev.getContent().key === keyId) {
                    this.accountDataAdapter.removeListener(ClientEvent.AccountData, listener);
                    resolve();
                }
            };
            this.accountDataAdapter.on(ClientEvent.AccountData, listener);

            this.accountDataAdapter.setAccountData("m.secret_storage.default_key", { key: keyId }).catch((e) => {
                this.accountDataAdapter.removeListener(ClientEvent.AccountData, listener);
                reject(e);
            });
        });
    }

    /**
     * Add a key for encrypting secrets.
     *
     * @param algorithm - the algorithm used by the key.
     * @param opts - the options for the algorithm.  The properties used
     *     depend on the algorithm given.
     * @param keyId - the ID of the key.  If not given, a random
     *     ID will be generated.
     *
     * @returns An object with:
     *     keyId: the ID of the key
     *     keyInfo: details about the key (iv, mac, passphrase)
     */
    public async addKey(
        algorithm: string,
        opts: AddSecretStorageKeyOpts = {},
        keyId?: string,
    ): Promise<SecretStorageKeyObject> {
        if (algorithm !== SECRET_STORAGE_ALGORITHM_V1_AES) {
            throw new Error(`Unknown key algorithm ${algorithm}`);
        }

        const keyInfo = { algorithm } as SecretStorageKeyDescriptionAesV1;

        if (opts.name) {
            keyInfo.name = opts.name;
        }

        if (opts.passphrase) {
            keyInfo.passphrase = opts.passphrase;
        }
        if (opts.key) {
            const { iv, mac } = await calculateKeyCheck(opts.key);
            keyInfo.iv = iv;
            keyInfo.mac = mac;
        }

        // Create a unique key id. XXX: this is racey.
        if (!keyId) {
            do {
                keyId = randomString(32);
            } while (
                await this.accountDataAdapter.getAccountDataFromServer<SecretStorageKeyDescription>(
                    `m.secret_storage.key.${keyId}`,
                )
            );
        }

        await this.accountDataAdapter.setAccountData(`m.secret_storage.key.${keyId}`, keyInfo);

        return {
            keyId,
            keyInfo,
        };
    }

    /**
     * Get the key information for a given ID.
     *
     * @param keyId - The ID of the key to check
     *     for. Defaults to the default key ID if not provided.
     * @returns If the key was found, the return value is an array of
     *     the form [keyId, keyInfo].  Otherwise, null is returned.
     *     XXX: why is this an array when addKey returns an object?
     */
    public async getKey(keyId?: string | null): Promise<SecretStorageKeyTuple | null> {
        if (!keyId) {
            keyId = await this.getDefaultKeyId();
        }
        if (!keyId) {
            return null;
        }

        const keyInfo = await this.accountDataAdapter.getAccountDataFromServer<SecretStorageKeyDescriptionAesV1>(
            "m.secret_storage.key." + keyId,
        );
        return keyInfo ? [keyId, keyInfo] : null;
    }

    /**
     * Check whether we have a key with a given ID.
     *
     * @param keyId - The ID of the key to check
     *     for. Defaults to the default key ID if not provided.
     * @returns Whether we have the key.
     */
    public async hasKey(keyId?: string): Promise<boolean> {
        const key = await this.getKey(keyId);
        return Boolean(key);
    }

    /**
     * Check whether a key matches what we expect based on the key info
     *
     * @param key - the key to check
     * @param info - the key info
     *
     * @returns whether or not the key matches
     */
    public async checkKey(key: Uint8Array, info: SecretStorageKeyDescriptionAesV1): Promise<boolean> {
        if (info.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
            if (info.mac) {
                const { mac } = await calculateKeyCheck(key, info.iv);
                return trimTrailingEquals(info.mac) === trimTrailingEquals(mac);
            } else {
                // if we have no information, we have to assume the key is right
                return true;
            }
        } else {
            throw new Error("Unknown algorithm");
        }
    }

    /**
     * Store an encrypted secret on the server.
     *
     * Details of the encryption keys to be used must previously have been stored in account data
     * (for example, via {@link ServerSideSecretStorageImpl#addKey}. {@link SecretStorageCallbacks#getSecretStorageKey} will be called to obtain a secret storage
     * key to decrypt the secret.
     *
     * @param name - The name of the secret - i.e., the "event type" to be stored in the account data
     * @param secret - The secret contents.
     * @param keys - The IDs of the keys to use to encrypt the secret, or null/undefined to use the default key.
     */
    public async store(name: string, secret: string, keys?: string[] | null): Promise<void> {
        const encrypted: Record<string, IEncryptedPayload> = {};

        if (!keys) {
            const defaultKeyId = await this.getDefaultKeyId();
            if (!defaultKeyId) {
                throw new Error("No keys specified and no default key present");
            }
            keys = [defaultKeyId];
        }

        if (keys.length === 0) {
            throw new Error("Zero keys given to encrypt with!");
        }

        for (const keyId of keys) {
            // get key information from key storage
            const keyInfo = await this.accountDataAdapter.getAccountDataFromServer<SecretStorageKeyDescriptionAesV1>(
                "m.secret_storage.key." + keyId,
            );
            if (!keyInfo) {
                throw new Error("Unknown key: " + keyId);
            }

            // encrypt secret, based on the algorithm
            if (keyInfo.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
                const keys = { [keyId]: keyInfo };
                const [, encryption] = await this.getSecretStorageKey(keys, name);
                encrypted[keyId] = await encryption.encrypt(secret);
            } else {
                logger.warn("unknown algorithm for secret storage key " + keyId + ": " + keyInfo.algorithm);
                // do nothing if we don't understand the encryption algorithm
            }
        }

        // save encrypted secret
        await this.accountDataAdapter.setAccountData(name, { encrypted });
    }

    /**
     * Get a secret from storage, and decrypt it.
     *
     * {@link SecretStorageCallbacks#getSecretStorageKey} will be called to obtain a secret storage
     * key to decrypt the secret.
     *
     * @param name - the name of the secret - i.e., the "event type" stored in the account data
     *
     * @returns the decrypted contents of the secret, or "undefined" if `name` is not found in
     *    the user's account data.
     */
    public async get(name: string): Promise<string | undefined> {
        const secretInfo = await this.accountDataAdapter.getAccountDataFromServer<SecretInfo>(name);
        if (!secretInfo) {
            return;
        }
        if (!secretInfo.encrypted) {
            throw new Error("Content is not encrypted!");
        }

        // get possible keys to decrypt
        const keys: Record<string, SecretStorageKeyDescriptionAesV1> = {};
        for (const keyId of Object.keys(secretInfo.encrypted)) {
            // get key information from key storage
            const keyInfo = await this.accountDataAdapter.getAccountDataFromServer<SecretStorageKeyDescriptionAesV1>(
                "m.secret_storage.key." + keyId,
            );
            const encInfo = secretInfo.encrypted[keyId];
            // only use keys we understand the encryption algorithm of
            if (keyInfo?.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
                if (encInfo.iv && encInfo.ciphertext && encInfo.mac) {
                    keys[keyId] = keyInfo;
                }
            }
        }

        if (Object.keys(keys).length === 0) {
            throw new Error(
                `Could not decrypt ${name} because none of ` +
                    `the keys it is encrypted with are for a supported algorithm`,
            );
        }

        // fetch private key from app
        const [keyId, decryption] = await this.getSecretStorageKey(keys, name);
        const encInfo = secretInfo.encrypted[keyId];

        return decryption.decrypt(encInfo);
    }

    /**
     * Check if a secret is stored on the server.
     *
     * @param name - the name of the secret
     *
     * @returns map of key name to key info the secret is encrypted
     *     with, or null if it is not present or not encrypted with a trusted
     *     key
     */
    public async isStored(name: string): Promise<Record<string, SecretStorageKeyDescriptionAesV1> | null> {
        // check if secret exists
        const secretInfo = await this.accountDataAdapter.getAccountDataFromServer<SecretInfo>(name);
        if (!secretInfo?.encrypted) return null;

        const ret: Record<string, SecretStorageKeyDescriptionAesV1> = {};

        // filter secret encryption keys with supported algorithm
        for (const keyId of Object.keys(secretInfo.encrypted)) {
            // get key information from key storage
            const keyInfo = await this.accountDataAdapter.getAccountDataFromServer<SecretStorageKeyDescriptionAesV1>(
                "m.secret_storage.key." + keyId,
            );
            if (!keyInfo) continue;
            const encInfo = secretInfo.encrypted[keyId];

            // only use keys we understand the encryption algorithm of
            if (keyInfo.algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
                if (encInfo.iv && encInfo.ciphertext && encInfo.mac) {
                    ret[keyId] = keyInfo;
                }
            }
        }
        return Object.keys(ret).length ? ret : null;
    }

    private async getSecretStorageKey(
        keys: Record<string, SecretStorageKeyDescriptionAesV1>,
        name: string,
    ): Promise<[string, Decryptors]> {
        if (!this.callbacks.getSecretStorageKey) {
            throw new Error("No getSecretStorageKey callback supplied");
        }

        const returned = await this.callbacks.getSecretStorageKey({ keys }, name);

        if (!returned) {
            throw new Error("getSecretStorageKey callback returned falsey");
        }
        if (returned.length < 2) {
            throw new Error("getSecretStorageKey callback returned invalid data");
        }

        const [keyId, privateKey] = returned;
        if (!keys[keyId]) {
            throw new Error("App returned unknown key from getSecretStorageKey!");
        }

        if (keys[keyId].algorithm === SECRET_STORAGE_ALGORITHM_V1_AES) {
            const decryption = {
                encrypt: function (secret: string): Promise<IEncryptedPayload> {
                    return encryptAES(secret, privateKey, name);
                },
                decrypt: function (encInfo: IEncryptedPayload): Promise<string> {
                    return decryptAES(encInfo, privateKey, name);
                },
            };
            return [keyId, decryption];
        } else {
            throw new Error("Unknown key type: " + keys[keyId].algorithm);
        }
    }
}

/** trim trailing instances of '=' from a string
 *
 * @internal
 *
 * @param input - input string
 */
export function trimTrailingEquals(input: string): string {
    // according to Sonar and CodeQL, a regex such as /=+$/ is superlinear.
    // Not sure I believe it, but it's easy enough to work around.

    // find the number of characters before the trailing =
    let i = input.length;
    while (i >= 1 && input.charCodeAt(i - 1) == 0x3d) i--;

    // trim to the calculated length
    if (i < input.length) {
        return input.substring(0, i);
    } else {
        return input;
    }
}
