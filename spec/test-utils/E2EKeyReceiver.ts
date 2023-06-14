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

import debugFunc from "debug";
import { Debugger } from "debug";
import fetchMock from "fetch-mock-jest";

import type { IDeviceKeys, IOneTimeKey } from "../../src/@types/crypto";

/** Interface implemented by classes that intercept `/keys/upload` requests from test clients to catch the uploaded keys
 *
 * Common interface implemented by {@link TestClient} and {@link E2EKeyReceiver}
 */
export interface IE2EKeyReceiver {
    /**
     * get the uploaded ed25519 device key
     *
     * @returns base64 device key
     */
    getSigningKey(): string;

    /**
     * get the uploaded curve25519 device key
     *
     * @returns base64 device key
     */
    getDeviceKey(): string;

    /**
     * Wait for one-time-keys to be uploaded, then return them.
     *
     * @returns Promise for the one-time keys
     */
    awaitOneTimeKeyUpload(): Promise<Record<string, IOneTimeKey>>;
}

/** E2EKeyReceiver: An object which intercepts `/keys/uploads` fetches via fetch-mock.
 *
 * It stashes the uploaded keys for use elsewhere in the tests.
 */
export class E2EKeyReceiver implements IE2EKeyReceiver {
    private readonly debug: Debugger;

    private deviceKeys: IDeviceKeys | null = null;
    private oneTimeKeys: Record<string, IOneTimeKey> = {};
    private readonly oneTimeKeysPromise: Promise<void>;

    /**
     * Construct a new E2EKeyReceiver.
     *
     * It will immediately register an intercept of `/keys/uploads` requests for the given homeserverUrl.
     * Only /upload requests made to this server will be intercepted: this allows a single test to use more than one
     * client and have the keys collected separately.
     *
     * @param homeserverUrl - the Homeserver Url of the client under test.
     */
    public constructor(homeserverUrl: string) {
        this.debug = debugFunc(`e2e-key-receiver:[${homeserverUrl}]`);

        // set up a listener for /keys/upload.
        this.oneTimeKeysPromise = new Promise((resolveOneTimeKeys) => {
            const listener = (url: string, options: RequestInit) =>
                this.onKeyUploadRequest(resolveOneTimeKeys, options);

            // catch both r0 and v3 variants
            fetchMock.post(new URL("/_matrix/client/r0/keys/upload", homeserverUrl).toString(), listener);
            fetchMock.post(new URL("/_matrix/client/v3/keys/upload", homeserverUrl).toString(), listener);
        });
    }

    private async onKeyUploadRequest(onOnTimeKeysUploaded: () => void, options: RequestInit): Promise<object> {
        const content = JSON.parse(options.body as string);

        // device keys may only be uploaded once
        if (content.device_keys && Object.keys(content.device_keys).length > 0) {
            if (this.deviceKeys) {
                throw new Error("Application attempted to upload E2E device keys multiple times");
            }
            this.debug(`received device keys`);
            this.deviceKeys = content.device_keys;
        }

        if (content.one_time_keys && Object.keys(content.one_time_keys).length > 0) {
            // this is a one-time-key upload

            // if we already have a batch of one-time keys, then slow-roll the response,
            // otherwise the client ends up tight-looping one-time-key-uploads and filling the logs with junk.
            if (Object.keys(this.oneTimeKeys).length > 0) {
                this.debug(`received second batch of one-time keys: blocking response`);
                await new Promise(() => {});
            }

            this.debug(`received ${Object.keys(content.one_time_keys).length} one-time keys`);
            Object.assign(this.oneTimeKeys, content.one_time_keys);
            onOnTimeKeysUploaded();
        }

        return {
            one_time_key_counts: {
                signed_curve25519: Object.keys(this.oneTimeKeys).length,
            },
        };
    }

    /** Get the uploaded Ed25519 key
     *
     * If device keys have not yet been uploaded, throws an error
     */
    public getSigningKey(): string {
        if (!this.deviceKeys) {
            throw new Error("Device keys not yet uploaded");
        }
        const keyIds = Object.keys(this.deviceKeys.keys).filter((v) => v.startsWith("ed25519:"));
        if (keyIds.length != 1) {
            throw new Error(`Expected exactly 1 ed25519 key uploaded, got ${keyIds}`);
        }
        return this.deviceKeys.keys[keyIds[0]];
    }

    /** Get the uploaded Curve25519 key
     *
     * If device keys have not yet been uploaded, throws an error
     */
    public getDeviceKey(): string {
        if (!this.deviceKeys) {
            throw new Error("Device keys not yet uploaded");
        }
        const keyIds = Object.keys(this.deviceKeys.keys).filter((v) => v.startsWith("curve25519:"));
        if (keyIds.length != 1) {
            throw new Error(`Expected exactly 1 curve25519 key uploaded, got ${keyIds}`);
        }
        return this.deviceKeys.keys[keyIds[0]];
    }

    /**
     * If one-time keys have already been uploaded, return them. Otherwise,
     * set up an expectation that the keys will be uploaded, and wait for
     * that to happen.
     *
     * @returns Promise for the one-time keys
     */
    public async awaitOneTimeKeyUpload(): Promise<Record<string, IOneTimeKey>> {
        await this.oneTimeKeysPromise;
        return this.oneTimeKeys;
    }
}
