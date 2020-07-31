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

import { Whenable } from "../../utils/Whenable";

export type RunFn = () => Promise<void>;

export enum TransactionStatus {
    Pending,
    DoneSuccess,
    DoneError,
}

export class EchoTransaction extends Whenable<TransactionStatus> {
    private _status = TransactionStatus.Pending;
    private didFail = false;

    public readonly startTime = new Date();

    public constructor(
        public readonly auditName,
        public runFn: RunFn,
    ) {
        super();
    }

    public get didPreviouslyFail(): boolean {
        return this.didFail;
    }

    public get status(): TransactionStatus {
        return this._status;
    }

    public run() {
        if (this.status === TransactionStatus.DoneSuccess) {
            throw new Error("Cannot re-run a successful echo transaction");
        }
        this.setStatus(TransactionStatus.Pending);
        this.runFn()
            .then(() => this.setStatus(TransactionStatus.DoneSuccess))
            .catch(() => this.setStatus(TransactionStatus.DoneError));
    }

    public cancel() {
        // Success basically means "done"
        this.setStatus(TransactionStatus.DoneSuccess);
    }

    private setStatus(status: TransactionStatus) {
        this._status = status;
        if (status === TransactionStatus.DoneError) {
            this.didFail = true;
        } else if (status === TransactionStatus.DoneSuccess) {
            this.didFail = false;
        }
        this.notifyCondition(status);
    }
}
