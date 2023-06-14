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

import { RendezvousFailureListener, RendezvousFailureReason } from ".";

export interface RendezvousTransportDetails {
    type: string;
}

/**
 * Interface representing a generic rendezvous transport.
 */
export interface RendezvousTransport<T> {
    /**
     * Ready state of the transport. This is set to true when the transport is ready to be used.
     */
    readonly ready: boolean;

    /**
     * Listener for cancellation events. This is called when the rendezvous is cancelled or fails.
     */
    onFailure?: RendezvousFailureListener;

    /**
     * @returns the transport details that can be encoded in a QR or similar
     */
    details(): Promise<RendezvousTransportDetails>;

    /**
     * Send data via the transport.
     * @param data - the data itself
     */
    send(data: T): Promise<void>;

    /**
     * Receive data from the transport.
     */
    receive(): Promise<Partial<T> | undefined>;

    /**
     * Cancel the rendezvous. This will call `onCancelled()` if it is set.
     * @param reason - the reason for the cancellation/failure
     */
    cancel(reason: RendezvousFailureReason): Promise<void>;
}
