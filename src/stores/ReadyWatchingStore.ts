/*
 * Copyright 2021 The Matrix.org Foundation C.I.C.
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
import { MatrixClientPeg } from "../MatrixClientPeg";
import { ActionPayload } from "../dispatcher/payloads";
import { Dispatcher } from "flux";
import { IDestroyable } from "../utils/IDestroyable";
import { EventEmitter } from "events";

export abstract class ReadyWatchingStore extends EventEmitter implements IDestroyable {
    protected matrixClient: MatrixClient;
    private readonly dispatcherRef: string;

    constructor(protected readonly dispatcher: Dispatcher<ActionPayload>) {
        super();

        this.dispatcherRef = this.dispatcher.register(this.onAction);

        if (MatrixClientPeg.get()) {
            this.matrixClient = MatrixClientPeg.get();

            // noinspection JSIgnoredPromiseFromCall
            this.onReady();
        }
    }

    public get mxClient(): MatrixClient {
        return this.matrixClient; // for external readonly access
    }

    public useUnitTestClient(cli: MatrixClient) {
        this.matrixClient = cli;
    }

    public destroy() {
        this.dispatcher.unregister(this.dispatcherRef);
    }

    protected async onReady() {
        // Default implementation is to do nothing.
    }

    protected async onNotReady() {
        // Default implementation is to do nothing.
    }

    private onAction = async (payload: ActionPayload) => {
        if (payload.action === 'MatrixActions.sync') {
            // Only set the client on the transition into the PREPARED state.
            // Everything after this is unnecessary (we only need to know once we have a client)
            // and we intentionally don't set the client before this point to avoid stores
            // updating for every event emitted during the cached sync.
            if (!(payload.prevState === 'PREPARED' && payload.state !== 'PREPARED')) {
                return;
            }

            if (this.matrixClient !== payload.matrixClient) {
                if (this.matrixClient) {
                    await this.onNotReady();
                }
                this.matrixClient = payload.matrixClient;
                await this.onReady();
            }
        } else if (payload.action === 'on_client_not_viable' || payload.action === 'on_logged_out') {
            if (this.matrixClient) {
                await this.onNotReady();
                this.matrixClient = null;
            }
        }
    };
}
