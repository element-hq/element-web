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

import type { MatrixClient, ISendEventResponse } from "matrix-js-sdk/src/matrix";
import type { AddSecretStorageKeyOpts } from "matrix-js-sdk/src/secret-storage";
import type { Credentials, HomeserverInstance } from "../plugins/homeserver";

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

export class Bot {
    private client: JSHandle<MatrixClient>;
    public credentials?: Credentials;

    constructor(private page: Page, private homeserver: HomeserverInstance, private readonly opts: CreateBotOpts) {
        this.opts = Object.assign({}, defaultCreateBotOptions, opts);
    }

    public async start(): Promise<void> {
        this.credentials = await this.getCredentials();
        this.client = await this.setupBotClient();
    }

    private async getCredentials(): Promise<Credentials> {
        const username = uniqueId(this.opts.userIdPrefix);
        const password = uniqueId("password_");
        console.log(`getBot: Create bot user ${username} with opts ${JSON.stringify(this.opts)}`);
        return await this.homeserver.registerUser(username, password, this.opts.displayName);
    }

    private async setupBotClient(): Promise<JSHandle<MatrixClient>> {
        return this.page.evaluateHandle(
            async ({ homeserver, credentials, opts }) => {
                const keys = {};

                const getCrossSigningKey = (type: string) => {
                    return keys[type];
                };

                const saveCrossSigningKeys = (k: Record<string, Uint8Array>) => {
                    Object.assign(keys, k);
                };

                // Store the cached secret storage key and return it when `getSecretStorageKey` is called
                let cachedKey: { keyId: string; key: Uint8Array };
                const cacheSecretStorageKey = (keyId: string, keyInfo: AddSecretStorageKeyOpts, key: Uint8Array) => {
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
                });

                if (opts.autoAcceptInvites) {
                    cli.on((window as any).matrixcs.RoomMemberEvent.Membership, (event, member) => {
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
                credentials: this.credentials,
                opts: this.opts,
            },
        );
    }

    /**
     * Make this bot join a room by name
     * @param roomName Name of the room to join
     */
    public async joinRoomByName(roomName: string): Promise<void> {
        await this.client.evaluate(
            (client, { roomName }) => {
                const room = client.getRooms().find((r) => r.getDefaultRoomName(client.getUserId()) === roomName);
                if (room) {
                    return client.joinRoom(room.roomId);
                }
                throw new Error(`Bot room join failed. Cannot find room '${roomName}'`);
            },
            {
                roomName,
            },
        );
    }

    /**
     * Send a message as a bot into a room
     * @param roomId ID of the room to join
     * @param message the message body to send
     */
    public async sendStringMessage(roomId: string, message: string): Promise<ISendEventResponse> {
        return this.client.evaluate(
            (client, { roomId, message }) => {
                return client.sendMessage(roomId, {
                    msgtype: "m.text",
                    body: message,
                });
            },
            {
                roomId,
                message,
            },
        );
    }
}
