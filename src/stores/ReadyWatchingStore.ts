/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2021, 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
 * Please see LICENSE files in the repository root for full details.
 */

import { MatrixClient, SyncState } from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "events";

import { ActionPayload } from "../dispatcher/payloads";
import { IDestroyable } from "../utils/IDestroyable";
import { Action } from "../dispatcher/actions";
import { MatrixDispatcher } from "../dispatcher/dispatcher";

export abstract class ReadyWatchingStore extends EventEmitter implements IDestroyable {
    private static instances: ReadyWatchingStore[] = [];
    protected _matrixClient: MatrixClient | null = null;
    private dispatcherRef: string | null = null;

    public static set matrixClient(client: MatrixClient) {
        for (const instance of ReadyWatchingStore.instances) {
            instance.start(client);
        }
    }

    public constructor(protected readonly dispatcher: MatrixDispatcher) {
        super();

        this.dispatcherRef = this.dispatcher.register(this.onAction);
    }

    public get matrixClient(): MatrixClient | null {
        return this._matrixClient;
    }

    public async start(matrixClient: MatrixClient | null): Promise<void> {
        const oldClient = this._matrixClient;
        this._matrixClient = matrixClient;

        if (oldClient !== matrixClient) {
            await this.onNotReady();
        }
        if (matrixClient) {
            await this.onReady();
        }
    }

    public get mxClient(): MatrixClient | null {
        return this.matrixClient; // for external readonly access
    }

    // XXX: This method is intended only for use in tests.
    public async useUnitTestClient(cli: MatrixClient): Promise<void> {
        this._matrixClient = cli;
        await this.onReady();
    }

    public destroy(): void {
        if (this.dispatcherRef !== null) this.dispatcher.unregister(this.dispatcherRef);
    }

    protected async onReady(): Promise<void> {
        // Default implementation is to do nothing.
    }

    protected async onNotReady(): Promise<void> {
        // Default implementation is to do nothing.
    }

    protected onDispatcherAction(payload: ActionPayload): void {
        // Default implementation is to do nothing.
    }

    private onAction = async (payload: ActionPayload): Promise<void> => {
        this.onDispatcherAction(payload);

        if (payload.action === "MatrixActions.sync") {
            // Only set the client on the transition into the PREPARED state.
            // Everything after this is unnecessary (we only need to know once we have a client)
            // and we intentionally don't set the client before this point to avoid stores
            // updating for every event emitted during the cached sync.
            if (
                payload.prevState !== SyncState.Prepared &&
                payload.state === SyncState.Prepared &&
                this.matrixClient !== payload.matrixClient
            ) {
                if (this.matrixClient) {
                    await this.onNotReady();
                }
                this._matrixClient = payload.matrixClient;
                await this.onReady();
            }
        } else if (payload.action === "on_client_not_viable" || payload.action === Action.OnLoggedOut) {
            if (this.matrixClient) {
                await this.onNotReady();
                this._matrixClient = null;
            }
        }
    };
}
