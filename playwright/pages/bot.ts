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

import { JSHandle, Page } from "@playwright/test";
import { uniqueId } from "lodash";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import type { Logger } from "matrix-js-sdk/src/logger";
import type { SecretStorageKeyDescription } from "matrix-js-sdk/src/secret-storage";
import type { Credentials, HomeserverInstance } from "../plugins/homeserver";
import type { GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";
import { Client } from "./client";

export interface CreateBotOpts {
    /**
     * A prefix to use for the userid. If unspecified, "bot_" will be used.
     */
    userIdPrefix?: string;
    /**
     * Whether the bot should automatically accept all invites.
     */
    autoAcceptInvites?: boolean;
    /**
     * The display name to give to that bot user
     */
    displayName?: string;
    /**
     * Whether to start the syncing client.
     */
    startClient?: boolean;
    /**
     * Whether to generate cross-signing keys
     */
    bootstrapCrossSigning?: boolean;
    /**
     * Whether to use the rust crypto impl. Defaults to false (for now!)
     */
    rustCrypto?: boolean;
    /**
     * Whether to bootstrap the secret storage
     */
    bootstrapSecretStorage?: boolean;
}

const defaultCreateBotOptions = {
    userIdPrefix: "bot_",
    autoAcceptInvites: true,
    startClient: true,
    bootstrapCrossSigning: true,
} satisfies CreateBotOpts;

type ExtendedMatrixClient = MatrixClient & { __playwright_recovery_key: GeneratedSecretStorageKey };

export class Bot extends Client {
    public credentials?: Credentials;
    private handlePromise: Promise<JSHandle<ExtendedMatrixClient>>;

    constructor(page: Page, private homeserver: HomeserverInstance, private readonly opts: CreateBotOpts) {
        super(page);
        this.opts = Object.assign({}, defaultCreateBotOptions, opts);
    }

    public setCredentials(credentials: Credentials): void {
        if (this.credentials) throw new Error("Bot has already started");
        this.credentials = credentials;
    }

    public async getRecoveryKey(): Promise<GeneratedSecretStorageKey> {
        const client = await this.getClientHandle();
        return client.evaluate((cli) => cli.__playwright_recovery_key);
    }

    private async getCredentials(): Promise<Credentials> {
        if (this.credentials) return this.credentials;
        // We want to pad the uniqueId but not the prefix
        const username =
            this.opts.userIdPrefix +
            uniqueId(this.opts.userIdPrefix)
                .substring(this.opts.userIdPrefix?.length ?? 0)
                .padStart(4, "0");
        const password = uniqueId("password_");
        console.log(`getBot: Create bot user ${username} with opts ${JSON.stringify(this.opts)}`);
        this.credentials = await this.homeserver.registerUser(username, password, this.opts.displayName);
        return this.credentials;
    }

    protected async getClientHandle(): Promise<JSHandle<ExtendedMatrixClient>> {
        if (this.handlePromise) return this.handlePromise;

        this.handlePromise = this.page.evaluateHandle(
            async ({ homeserver, credentials, opts }) => {
                function getLogger(loggerName: string): Logger {
                    const logger = {
                        getChild: (namespace: string) => getLogger(`${loggerName}:${namespace}`),
                        trace(...msg: any[]): void {
                            console.trace(loggerName, ...msg);
                        },
                        debug(...msg: any[]): void {
                            console.debug(loggerName, ...msg);
                        },
                        info(...msg: any[]): void {
                            console.info(loggerName, ...msg);
                        },
                        warn(...msg: any[]): void {
                            console.warn(loggerName, ...msg);
                        },
                        error(...msg: any[]): void {
                            console.error(loggerName, ...msg);
                        },
                    } satisfies Logger;

                    return logger as unknown as Logger;
                }

                const logger = getLogger(`cypress bot ${credentials.userId}`);

                const keys = {};

                const getCrossSigningKey = (type: string) => {
                    return keys[type];
                };

                const saveCrossSigningKeys = (k: Record<string, Uint8Array>) => {
                    Object.assign(keys, k);
                };

                // Store the cached secret storage key and return it when `getSecretStorageKey` is called
                let cachedKey: { keyId: string; key: Uint8Array };
                const cacheSecretStorageKey = (
                    keyId: string,
                    keyInfo: SecretStorageKeyDescription,
                    key: Uint8Array,
                ) => {
                    cachedKey = {
                        keyId,
                        key,
                    };
                };

                const getSecretStorageKey = () =>
                    Promise.resolve<[string, Uint8Array]>([cachedKey.keyId, cachedKey.key]);

                const cryptoCallbacks = {
                    getCrossSigningKey,
                    saveCrossSigningKeys,
                    cacheSecretStorageKey,
                    getSecretStorageKey,
                };

                const cli = new window.matrixcs.MatrixClient({
                    baseUrl: homeserver.baseUrl,
                    userId: credentials.userId,
                    deviceId: credentials.deviceId,
                    accessToken: credentials.accessToken,
                    store: new window.matrixcs.MemoryStore(),
                    scheduler: new window.matrixcs.MatrixScheduler(),
                    cryptoStore: new window.matrixcs.MemoryCryptoStore(),
                    cryptoCallbacks,
                    logger,
                }) as ExtendedMatrixClient;

                if (opts.autoAcceptInvites) {
                    cli.on(window.matrixcs.RoomMemberEvent.Membership, (event, member) => {
                        if (member.membership === "invite" && member.userId === cli.getUserId()) {
                            cli.joinRoom(member.roomId);
                        }
                    });
                }

                if (!opts.startClient) {
                    return cli;
                }

                if (opts.rustCrypto) {
                    await cli.initRustCrypto({ useIndexedDB: false });
                } else {
                    await cli.initCrypto();
                }
                cli.setGlobalErrorOnUnknownDevices(false);
                await cli.startClient();

                if (opts.bootstrapCrossSigning) {
                    await cli.getCrypto()!.bootstrapCrossSigning({
                        authUploadDeviceSigningKeys: async (func) => {
                            await func({
                                type: "m.login.password",
                                identifier: {
                                    type: "m.id.user",
                                    user: credentials.userId,
                                },
                                password: credentials.password,
                            });
                        },
                    });
                }

                if (opts.bootstrapSecretStorage) {
                    const passphrase = "new passphrase";
                    const recoveryKey = await cli.getCrypto().createRecoveryKeyFromPassphrase(passphrase);
                    Object.assign(cli, { __playwright_recovery_key: recoveryKey });

                    await cli.getCrypto()!.bootstrapSecretStorage({
                        setupNewSecretStorage: true,
                        setupNewKeyBackup: true,
                        createSecretStorageKey: () => Promise.resolve(recoveryKey),
                    });
                }

                return cli;
            },
            {
                homeserver: this.homeserver.config,
                credentials: await this.getCredentials(),
                opts: this.opts,
            },
        );
        return this.handlePromise;
    }
}
