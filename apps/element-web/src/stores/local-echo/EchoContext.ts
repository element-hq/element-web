/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EchoTransaction, type RunFn, TransactionStatus } from "./EchoTransaction";
import { arrayFastClone } from "../../utils/arrays";
import { type IDestroyable } from "../../utils/IDestroyable";
import { Whenable } from "../../utils/Whenable";

export enum ContextTransactionState {
    NotStarted,
    PendingErrors,
    AllSuccessful,
}

export abstract class EchoContext extends Whenable<ContextTransactionState> implements IDestroyable {
    private _transactions: EchoTransaction[] = [];
    private _state = ContextTransactionState.NotStarted;

    public get transactions(): EchoTransaction[] {
        return arrayFastClone(this._transactions);
    }

    public get state(): ContextTransactionState {
        return this._state;
    }

    public get firstFailedTime(): Date | null {
        const failedTxn = this.transactions.find((t) => t.didPreviouslyFail || t.status === TransactionStatus.Error);
        if (failedTxn) return failedTxn.startTime;
        return null;
    }

    public disownTransaction(txn: EchoTransaction): void {
        const idx = this._transactions.indexOf(txn);
        if (idx >= 0) this._transactions.splice(idx, 1);
        txn.destroy();
        this.checkTransactions();
    }

    public beginTransaction(auditName: string, runFn: RunFn): EchoTransaction {
        const txn = new EchoTransaction(auditName, runFn);
        this._transactions.push(txn);
        txn.whenAnything(this.checkTransactions);

        // We have no intent to call the transaction again if it succeeds (in fact, it'll
        // be really angry at us if we do), so call that the end of the road for the events.
        txn.when(TransactionStatus.Success, () => txn.destroy());

        return txn;
    }

    private checkTransactions = (): void => {
        let status = ContextTransactionState.AllSuccessful;
        for (const txn of this.transactions) {
            if (txn.status === TransactionStatus.Error || txn.didPreviouslyFail) {
                status = ContextTransactionState.PendingErrors;
                break;
            } else if (txn.status === TransactionStatus.Pending) {
                status = ContextTransactionState.NotStarted;
                // no break as we might hit something which broke
            }
        }
        this._state = status;
        this.notifyCondition(status);
    };

    public destroy(): void {
        for (const txn of this.transactions) {
            txn.destroy();
        }
        this._transactions = [];
        super.destroy();
    }
}
