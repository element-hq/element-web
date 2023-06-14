/*
 * Copyright 2021 - 2022 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { MatrixClient } from "matrix-js-sdk/src/client";
import { SyncState } from "matrix-js-sdk/src/sync";
import { EventEmitter } from "events";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { ActionPayload } from "../dispatcher/payloads";
import { IDestroyable } from "../utils/IDestroyable";
import { Action } from "../dispatcher/actions";
import { MatrixDispatcher } from "../dispatcher/dispatcher";

export abstract class ReadyWatchingStore extends EventEmitter implements IDestroyable {
    protected matrixClient: MatrixClient | null = null;
    private dispatcherRef: string | null = null;

    public constructor(protected readonly dispatcher: MatrixDispatcher) {
        super();
    }

    public async start(): Promise<void> {
        this.dispatcherRef = this.dispatcher.register(this.onAction);

        const matrixClient = MatrixClientPeg.get();
        if (matrixClient) {
            this.matrixClient = matrixClient;
            await this.onReady();
        }
    }

    public get mxClient(): MatrixClient | null {
        return this.matrixClient; // for external readonly access
    }

    public useUnitTestClient(cli: MatrixClient): void {
        this.matrixClient = cli;
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
                this.matrixClient = payload.matrixClient;
                await this.onReady();
            }
        } else if (payload.action === "on_client_not_viable" || payload.action === Action.OnLoggedOut) {
            if (this.matrixClient) {
                await this.onNotReady();
                this.matrixClient = null;
            }
        }
    };
}
