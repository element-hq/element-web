/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { EventEmitter } from "events";

import { type EchoContext } from "./EchoContext";
import { type EchoTransaction, type RunFn, TransactionStatus } from "./EchoTransaction";

export async function implicitlyReverted(): Promise<void> {
    // do nothing :D
}

export const PROPERTY_UPDATED = "property_updated";

export abstract class GenericEchoChamber<C extends EchoContext, K, V> extends EventEmitter {
    private cache = new Map<K, { txn: EchoTransaction; val: V }>();
    protected matrixClient: MatrixClient | null = null;

    protected constructor(
        public readonly context: C,
        private lookupFn: (key: K) => V,
    ) {
        super();
    }

    public setClient(client: MatrixClient | null): void {
        const oldClient = this.matrixClient;
        this.matrixClient = client;
        this.onClientChanged(oldClient, client);
    }

    protected abstract onClientChanged(oldClient: MatrixClient | null, newClient: MatrixClient | null): void;

    /**
     * Gets a value. If the key is in flight, the cached value will be returned. If
     * the key is not in flight then the lookupFn provided to this class will be
     * called instead.
     * @param key The key to look up.
     * @returns The value for the key.
     */
    public getValue(key: K): V {
        return this.cache.has(key) ? this.cache.get(key)!.val : this.lookupFn(key);
    }

    private cacheVal(key: K, val: V, txn: EchoTransaction): void {
        this.cache.set(key, { txn, val });
        this.emit(PROPERTY_UPDATED, key);
    }

    private decacheKey(key: K): void {
        if (this.cache.has(key)) {
            this.context.disownTransaction(this.cache.get(key)!.txn);
            this.cache.delete(key);
            this.emit(PROPERTY_UPDATED, key);
        }
    }

    protected markEchoReceived(key: K): void {
        if (this.cache.has(key)) {
            const txn = this.cache.get(key)!.txn;
            this.context.disownTransaction(txn);
            txn.cancel();
        }
        this.decacheKey(key);
    }

    public setValue(auditName: string, key: K, targetVal: V, runFn: RunFn, revertFn: RunFn): void {
        // Cancel any pending transactions for the same key
        if (this.cache.has(key)) {
            this.cache.get(key)!.txn.cancel();
        }

        const ctxn = this.context.beginTransaction(auditName, runFn);
        this.cacheVal(key, targetVal, ctxn); // set the cache now as it won't be updated by the .when() ladder below.

        ctxn.when(TransactionStatus.Pending, () => this.cacheVal(key, targetVal, ctxn)).when(
            TransactionStatus.Error,
            () => revertFn(),
        );

        ctxn.run();
    }
}
