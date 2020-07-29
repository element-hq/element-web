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

import { EchoContext } from "./EchoContext";
import { RunFn, TransactionStatus } from "./EchoTransaction";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { EventEmitter } from "events";

export async function implicitlyReverted() {
    // do nothing :D
}

export const PROPERTY_UPDATED = "property_updated";

export abstract class CachedEcho<C extends EchoContext, K, V> extends EventEmitter {
    private cache = new Map<K, V>();
    protected matrixClient: MatrixClient;

    protected constructor(protected context: C, private lookupFn: (key: K) => V) {
        super();
    }

    public setClient(client: MatrixClient) {
        const oldClient = this.matrixClient;
        this.matrixClient = client;
        this.onClientChanged(oldClient, client);
    }

    protected abstract onClientChanged(oldClient: MatrixClient, newClient: MatrixClient);

    /**
     * Gets a value. If the key is in flight, the cached value will be returned. If
     * the key is not in flight then the lookupFn provided to this class will be
     * called instead.
     * @param key The key to look up.
     * @returns The value for the key.
     */
    public getValue(key: K): V {
        return this.cache.has(key) ? this.cache.get(key) : this.lookupFn(key);
    }

    private cacheVal(key: K, val: V) {
        this.cache.set(key, val);
        this.emit(PROPERTY_UPDATED, key);
    }

    private decacheKey(key: K) {
        this.cache.delete(key);
        this.emit(PROPERTY_UPDATED, key);
    }

    public setValue(auditName: string, key: K, targetVal: V, runFn: RunFn, revertFn: RunFn) {
        this.cacheVal(key, targetVal); // set the cache now as it won't be updated by the .when() ladder below.
        this.context.beginTransaction(auditName, runFn)
            .when(TransactionStatus.Pending, () => this.cacheVal(key, targetVal))
            .whenAnyOf([TransactionStatus.DoneError, TransactionStatus.DoneSuccess], () => this.decacheKey(key))
            .when(TransactionStatus.DoneError, () => revertFn());
    }
}
