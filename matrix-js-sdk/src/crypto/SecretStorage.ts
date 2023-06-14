/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

import { ICryptoCallbacks } from ".";
import { MatrixEvent } from "../models/event";
import { MatrixClient } from "../client";
import {
    SecretStorageKeyDescription,
    SecretStorageKeyTuple,
    SecretStorageKeyObject,
    AddSecretStorageKeyOpts,
    AccountDataClient,
    ServerSideSecretStorage,
    ServerSideSecretStorageImpl,
} from "../secret-storage";
import { ISecretRequest, SecretSharing } from "./SecretSharing";

/* re-exports for backwards compatibility */
export type {
    AccountDataClient as IAccountDataClient,
    SecretStorageKeyTuple,
    SecretStorageKeyObject,
    SECRET_STORAGE_ALGORITHM_V1_AES,
} from "../secret-storage";

export type { ISecretRequest } from "./SecretSharing";

/**
 * Implements Secure Secret Storage and Sharing (MSC1946)
 *
 * @deprecated This is just a backwards-compatibility hack which will be removed soon.
 *    Use {@link SecretStorage.ServerSideSecretStorageImpl} from `../secret-storage` and/or {@link SecretSharing} from `./SecretSharing`.
 */
export class SecretStorage<B extends MatrixClient | undefined = MatrixClient> implements ServerSideSecretStorage {
    private readonly storageImpl: ServerSideSecretStorageImpl;
    private readonly sharingImpl: SecretSharing;

    // In its pure javascript days, this was relying on some proper Javascript-style
    // type-abuse where sometimes we'd pass in a fake client object with just the account
    // data methods implemented, which is all this class needs unless you use the secret
    // sharing code, so it was fine. As a low-touch TypeScript migration, we added
    // an extra, optional param for a real matrix client, so you can not pass it as long
    // as you don't request any secrets.
    //
    // Nowadays, the whole class is scheduled for destruction, once we get rid of the legacy
    // Crypto impl that exposes it.
    public constructor(accountDataAdapter: AccountDataClient, cryptoCallbacks: ICryptoCallbacks, baseApis: B) {
        this.storageImpl = new ServerSideSecretStorageImpl(accountDataAdapter, cryptoCallbacks);
        this.sharingImpl = new SecretSharing(baseApis as MatrixClient, cryptoCallbacks);
    }

    public getDefaultKeyId(): Promise<string | null> {
        return this.storageImpl.getDefaultKeyId();
    }

    public setDefaultKeyId(keyId: string): Promise<void> {
        return this.storageImpl.setDefaultKeyId(keyId);
    }

    /**
     * Add a key for encrypting secrets.
     */
    public addKey(
        algorithm: string,
        opts: AddSecretStorageKeyOpts = {},
        keyId?: string,
    ): Promise<SecretStorageKeyObject> {
        return this.storageImpl.addKey(algorithm, opts, keyId);
    }

    /**
     * Get the key information for a given ID.
     */
    public getKey(keyId?: string | null): Promise<SecretStorageKeyTuple | null> {
        return this.storageImpl.getKey(keyId);
    }

    /**
     * Check whether we have a key with a given ID.
     */
    public hasKey(keyId?: string): Promise<boolean> {
        return this.storageImpl.hasKey(keyId);
    }

    /**
     * Check whether a key matches what we expect based on the key info
     */
    public checkKey(key: Uint8Array, info: SecretStorageKeyDescription): Promise<boolean> {
        return this.storageImpl.checkKey(key, info);
    }

    /**
     * Store an encrypted secret on the server
     */
    public store(name: string, secret: string, keys?: string[] | null): Promise<void> {
        return this.storageImpl.store(name, secret, keys);
    }

    /**
     * Get a secret from storage.
     */
    public get(name: string): Promise<string | undefined> {
        return this.storageImpl.get(name);
    }

    /**
     * Check if a secret is stored on the server.
     */
    public async isStored(name: string): Promise<Record<string, SecretStorageKeyDescription> | null> {
        return this.storageImpl.isStored(name);
    }

    /**
     * Request a secret from another device
     */
    public request(name: string, devices: string[]): ISecretRequest {
        return this.sharingImpl.request(name, devices);
    }

    public onRequestReceived(event: MatrixEvent): Promise<void> {
        return this.sharingImpl.onRequestReceived(event);
    }

    public onSecretReceived(event: MatrixEvent): void {
        this.sharingImpl.onSecretReceived(event);
    }
}
