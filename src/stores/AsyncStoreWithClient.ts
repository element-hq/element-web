/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { AsyncStore } from "./AsyncStore";
import { type ActionPayload } from "../dispatcher/payloads";
import { ReadyWatchingStore } from "./ReadyWatchingStore";
import { type MatrixDispatcher } from "../dispatcher/dispatcher";

export abstract class AsyncStoreWithClient<T extends object> extends AsyncStore<T> {
    protected readyStore: ReadyWatchingStore;

    protected constructor(dispatcher: MatrixDispatcher, initialState: T = <T>{}) {
        super(dispatcher, initialState);

        // Create an anonymous class to avoid code duplication
        const asyncStore = this; // eslint-disable-line @typescript-eslint/no-this-alias
        this.readyStore = new (class extends ReadyWatchingStore {
            public get mxClient(): MatrixClient | null {
                return this.matrixClient ?? null;
            }

            protected async onReady(): Promise<any> {
                return asyncStore.onReady();
            }

            protected async onNotReady(): Promise<any> {
                return asyncStore.onNotReady();
            }
        })(dispatcher);
    }

    public async start(): Promise<void> {
        await this.readyStore.start();
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
