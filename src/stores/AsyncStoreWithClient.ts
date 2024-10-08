/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { AsyncStore } from "./AsyncStore";
import { ActionPayload } from "../dispatcher/payloads";
import { ReadyWatchingStore } from "./ReadyWatchingStore";
import { MatrixDispatcher } from "../dispatcher/dispatcher";

export abstract class AsyncStoreWithClient<T extends Object> extends AsyncStore<T> {
    protected readyStore: ReadyWatchingStore;

    protected constructor(dispatcher: MatrixDispatcher, initialState: T = <T>{}) {
        super(dispatcher, initialState);

        // Create an anonymous class to avoid code duplication
        const asyncStore = this; // eslint-disable-line @typescript-eslint/no-this-alias
        this.readyStore = new (class extends ReadyWatchingStore {
            public get mxClient(): MatrixClient | null {
                return this.matrixClient;
            }

            protected async onReady(): Promise<any> {
                return asyncStore.onReady();
            }

            protected async onNotReady(): Promise<any> {
                return asyncStore.onNotReady();
            }
        })(dispatcher);
    }

    protected async start(matrixClient: MatrixClient | null): Promise<void> {
        await this.readyStore.start(matrixClient);
    }

    // XXX: This method is intended only for use in tests.
    public async useUnitTestClient(cli: MatrixClient): Promise<void> {
        await this.readyStore.useUnitTestClient(cli);
    }

    public get matrixClient(): MatrixClient | null {
        return this.readyStore.mxClient;
    }

    protected async onReady(): Promise<void> {
        // Default implementation is to do nothing.
    }

    protected async onNotReady(): Promise<void> {
        // Default implementation is to do nothing.
    }

    protected abstract onAction(payload: ActionPayload): Promise<void>;

    protected async onDispatch(payload: ActionPayload): Promise<void> {
        await this.onAction(payload);
    }
}
