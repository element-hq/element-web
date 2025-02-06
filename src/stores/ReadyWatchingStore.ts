/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2021, 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, SyncState } from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "events";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { type ActionPayload } from "../dispatcher/payloads";
import { type IDestroyable } from "../utils/IDestroyable";
import { Action } from "../dispatcher/actions";
import { type MatrixDispatcher } from "../dispatcher/dispatcher";

export abstract class ReadyWatchingStore extends EventEmitter implements IDestroyable {
    protected matrixClient?: MatrixClient;
    private dispatcherRef?: string;

    public constructor(protected readonly dispatcher: MatrixDispatcher) {
        super();
    }

    public async start(): Promise<void> {
        this.dispatcherRef = this.dispatcher.register(this.onAction);

        // MatrixClientPeg can be undefined in tests because of circular dependencies with other stores
        const matrixClient = MatrixClientPeg?.get();
        if (matrixClient) {
            this.matrixClient = matrixClient;
            await this.onReady();
        }
    }

    public get mxClient(): MatrixClient | null {
        return this.matrixClient ?? null; // for external readonly access
    }

    public useUnitTestClient(cli: MatrixClient): void {
        this.matrixClient = cli;
    }

    public destroy(): void {
        this.dispatcher.unregister(this.dispatcherRef);
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
                this.matrixClient = payload.matrixClient;
                await this.onReady();
            }
        } else if (payload.action === "on_client_not_viable" || payload.action === Action.OnLoggedOut) {
            if (this.matrixClient) {
                await this.onNotReady();
                this.matrixClient = undefined;
            }
        }
    };
}
