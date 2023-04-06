/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixClient } from "matrix-js-sdk/src/client";

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
