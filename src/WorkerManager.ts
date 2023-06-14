/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { defer, IDeferred } from "matrix-js-sdk/src/utils";

import { WorkerPayload } from "./workers/worker";

export class WorkerManager<Request extends {}, Response> {
    private readonly worker: Worker;
    private seq = 0;
    private pendingDeferredMap = new Map<number, IDeferred<Response>>();

    public constructor(WorkerConstructor: { new (): Worker }) {
        this.worker = new WorkerConstructor();
        this.worker.onmessage = this.onMessage;
    }

    private onMessage = (ev: MessageEvent<Response & WorkerPayload>): void => {
        const deferred = this.pendingDeferredMap.get(ev.data.seq);
        if (deferred) {
            this.pendingDeferredMap.delete(ev.data.seq);
            deferred.resolve(ev.data);
        }
    };

    public call(request: Request): Promise<Response> {
        const seq = this.seq++;
        const deferred = defer<Response>();
        this.pendingDeferredMap.set(seq, deferred);
        this.worker.postMessage({ seq, ...request });
        return deferred.promise;
    }
}
