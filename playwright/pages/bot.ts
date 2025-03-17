/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type JSHandle, type Page } from "@playwright/test";
import { uniqueId } from "lodash";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import type { Logger } from "matrix-js-sdk/src/logger";
import type { SecretStorageKeyDescription } from "matrix-js-sdk/src/secret-storage";
import type { Credentials, HomeserverInstance } from "../plugins/homeserver";
import type { GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";
import { bootstrapCrossSigningForClient, Client } from "./client";

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
     * Whether to bootstrap the secret storage
     */
    bootstrapSecretStorage?: boolean;
    /**
     * Whether to use a passphrase when creating the recovery key
     */
    usePassphrase?: boolean;
}

const defaultCreateBotOptions = {
    userIdPrefix: "bot_",
    autoAcceptInvites: true,
    startClient: true,
    bootstrapCrossSigning: true,
    usePassphrase: false,
} satisfies CreateBotOpts;

type ExtendedMatrixClient = MatrixClient & { __playwright_recovery_key: GeneratedSecretStorageKey };

export class Bot extends Client {
    public credentials?: Credentials;
    private handlePromise: Promise<JSHandle<ExtendedMatrixClient>>;

    constructor(
        page: Page,
        private homeserver: HomeserverInstance,
        private readonly opts: CreateBotOpts,
    ) {
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
        if (!this.handlePromise) this.handlePromise = this.buildClient();
        return this.handlePromise;
    }

    private async buildClient(): Promise<JSHandle<ExtendedMatrixClient>> {
        const credentials = await this.getCredentials();
        const clientHandle = await this.page.evaluateHandle(
            async ({ baseUrl, credentials, opts }) => {
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

                const logger = getLogger(`bot ${credentials.userId}`);

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
                    baseUrl,
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
                            void cli.joinRoom(member.roomId);
                        }
                    });
                }

                return cli;
            },
            {
                baseUrl: this.homeserver.baseUrl,
                credentials,
                opts: this.opts,
            },
        );

        // If we weren't configured to start the client, bail out now.
        if (!this.opts.startClient) {
            return clientHandle;
        }

        await clientHandle.evaluate(async (cli) => {
            await cli.initRustCrypto({ useIndexedDB: false });
            await cli.startClient();
        });

        if (this.opts.bootstrapCrossSigning) {
            // XXX: workaround https://github.com/element-hq/element-web/issues/26755
            //   wait for out device list to be available, as a proxy for the device keys having been uploaded.
            await clientHandle.evaluate(async (cli, credentials) => {
                await cli.getCrypto()!.getUserDeviceInfo([credentials.userId]);
            }, credentials);

            await bootstrapCrossSigningForClient(clientHandle, credentials);
        }

        if (this.opts.bootstrapSecretStorage) {
            await clientHandle.evaluate(async (cli, usePassphrase) => {
                const passphrase = usePassphrase ? "new passphrase" : undefined;
                const recoveryKey = await cli.getCrypto().createRecoveryKeyFromPassphrase(passphrase);
                Object.assign(cli, { __playwright_recovery_key: recoveryKey });

                await cli.getCrypto()!.bootstrapSecretStorage({
                    setupNewSecretStorage: true,
                    setupNewKeyBackup: true,
                    createSecretStorageKey: () => Promise.resolve(recoveryKey),
                });
            }, this.opts.usePassphrase);
        }

        return clientHandle;
    }
}
