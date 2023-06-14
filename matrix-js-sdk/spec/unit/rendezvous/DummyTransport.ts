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

import { logger } from "../../../src/logger";
import {
    RendezvousFailureListener,
    RendezvousFailureReason,
    RendezvousTransport,
    RendezvousTransportDetails,
} from "../../../src/rendezvous";
import { sleep } from "../../../src/utils";

export class DummyTransport<D extends RendezvousTransportDetails, T> implements RendezvousTransport<T> {
    otherParty?: DummyTransport<D, T>;
    etag?: string;
    lastEtagReceived?: string;
    data: T | undefined;

    ready = false;
    cancelled = false;

    constructor(private name: string, private mockDetails: D) {}
    onCancelled?: RendezvousFailureListener;

    details(): Promise<RendezvousTransportDetails> {
        return Promise.resolve(this.mockDetails);
    }

    async send(data: T): Promise<void> {
        logger.info(
            `[${this.name}] => [${this.otherParty?.name}] Attempting to send data: ${JSON.stringify(
                data,
            )} where etag matches ${this.etag}`,
        );
        // eslint-disable-next-line no-constant-condition
        while (!this.cancelled) {
            if (!this.etag || (this.otherParty?.etag && this.otherParty?.etag === this.etag)) {
                this.data = data;
                this.etag = Math.random().toString();
                this.lastEtagReceived = this.etag;
                this.otherParty!.etag = this.etag;
                this.otherParty!.data = data;
                logger.info(`[${this.name}] => [${this.otherParty?.name}] Sent with etag ${this.etag}`);
                return;
            }
            logger.info(`[${this.name}] Sleeping to retry send after etag ${this.etag}`);
            await sleep(250);
        }
    }

    async receive(): Promise<T | undefined> {
        logger.info(`[${this.name}] Attempting to receive where etag is after ${this.lastEtagReceived}`);
        // eslint-disable-next-line no-constant-condition
        while (!this.cancelled) {
            if (!this.lastEtagReceived || this.lastEtagReceived !== this.etag) {
                this.lastEtagReceived = this.etag;
                logger.info(
                    `[${this.otherParty?.name}] => [${this.name}] Received data: ` +
                        `${JSON.stringify(this.data)} with etag ${this.etag}`,
                );
                return this.data;
            }
            logger.info(
                `[${this.name}] Sleeping to retry receive after etag ${this.lastEtagReceived} as remote is ${this.etag}`,
            );
            await sleep(250);
        }

        return undefined;
    }

    cancel(reason: RendezvousFailureReason): Promise<void> {
        this.cancelled = true;
        this.onCancelled?.(reason);
        return Promise.resolve();
    }

    cleanup() {
        this.cancelled = true;
    }
}
