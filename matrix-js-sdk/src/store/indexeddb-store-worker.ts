/*
Copyright 2017 - 2021 The Matrix.org Foundation C.I.C.

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

import { LocalIndexedDBStoreBackend } from "./indexeddb-local-backend";
import { logger } from "../logger";

interface ICmd {
    command: string;
    seq: number;
    args: any[];
}

/**
 * This class lives in the webworker and drives a LocalIndexedDBStoreBackend
 * controlled by messages from the main process.
 *
 * @example
 * It should be instantiated by a web worker script provided by the application
 * in a script, for example:
 * ```
 * import {IndexedDBStoreWorker} from 'matrix-js-sdk/lib/indexeddb-worker.js';
 * const remoteWorker = new IndexedDBStoreWorker(postMessage);
 * onmessage = remoteWorker.onMessage;
 * ```
 *
 * Note that it is advisable to import this class by referencing the file directly to
 * avoid a dependency on the whole js-sdk.
 *
 */
export class IndexedDBStoreWorker {
    private backend?: LocalIndexedDBStoreBackend;

    /**
     * @param postMessage - The web worker postMessage function that
     * should be used to communicate back to the main script.
     */
    public constructor(private readonly postMessage: InstanceType<typeof Worker>["postMessage"]) {}

    private onClose = (): void => {
        this.postMessage.call(null, {
            command: "closed",
        });
    };

    /**
     * Passes a message event from the main script into the class. This method
     * can be directly assigned to the web worker `onmessage` variable.
     *
     * @param ev - The message event
     */
    public onMessage = (ev: MessageEvent): void => {
        const msg: ICmd = ev.data;
        let prom: Promise<any> | undefined;

        switch (msg.command) {
            case "setupWorker":
                // this is the 'indexedDB' global (where global != window
                // because it's a web worker and there is no window).
                this.backend = new LocalIndexedDBStoreBackend(indexedDB, msg.args[0]);
                prom = Promise.resolve();
                break;
            case "connect":
                prom = this.backend?.connect(this.onClose);
                break;
            case "isNewlyCreated":
                prom = this.backend?.isNewlyCreated();
                break;
            case "clearDatabase":
                prom = this.backend?.clearDatabase();
                break;
            case "getSavedSync":
                prom = this.backend?.getSavedSync(false);
                break;
            case "setSyncData":
                prom = this.backend?.setSyncData(msg.args[0]);
                break;
            case "syncToDatabase":
                prom = this.backend?.syncToDatabase(msg.args[0]);
                break;
            case "getUserPresenceEvents":
                prom = this.backend?.getUserPresenceEvents();
                break;
            case "getNextBatchToken":
                prom = this.backend?.getNextBatchToken();
                break;
            case "getOutOfBandMembers":
                prom = this.backend?.getOutOfBandMembers(msg.args[0]);
                break;
            case "clearOutOfBandMembers":
                prom = this.backend?.clearOutOfBandMembers(msg.args[0]);
                break;
            case "setOutOfBandMembers":
                prom = this.backend?.setOutOfBandMembers(msg.args[0], msg.args[1]);
                break;
            case "getClientOptions":
                prom = this.backend?.getClientOptions();
                break;
            case "storeClientOptions":
                prom = this.backend?.storeClientOptions(msg.args[0]);
                break;
            case "saveToDeviceBatches":
                prom = this.backend?.saveToDeviceBatches(msg.args[0]);
                break;
            case "getOldestToDeviceBatch":
                prom = this.backend?.getOldestToDeviceBatch();
                break;
            case "removeToDeviceBatch":
                prom = this.backend?.removeToDeviceBatch(msg.args[0]);
                break;
        }

        if (prom === undefined) {
            this.postMessage({
                command: "cmd_fail",
                seq: msg.seq,
                // Can't be an Error because they're not structured cloneable
                error: "Unrecognised command",
            });
            return;
        }

        prom.then(
            (ret) => {
                this.postMessage.call(null, {
                    command: "cmd_success",
                    seq: msg.seq,
                    result: ret,
                });
            },
            (err) => {
                logger.error("Error running command: " + msg.command, err);
                this.postMessage.call(null, {
                    command: "cmd_fail",
                    seq: msg.seq,
                    // Just send a string because Error objects aren't cloneable
                    error: {
                        message: err.message,
                        name: err.name,
                    },
                });
            },
        );
    };
}
