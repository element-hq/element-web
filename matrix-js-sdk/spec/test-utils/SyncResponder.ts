/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import debugFunc from "debug";
import { Debugger } from "debug";
import fetchMock from "fetch-mock-jest";
import { MockResponse } from "fetch-mock";

/** Interface implemented by classes that intercept `/sync` requests from test clients
 *
 * Common interface implemented by {@link TestClient} and {@link SyncResponder}
 */
export interface ISyncResponder {
    /** Next time we see a sync request (or immediately, if there is one waiting), send the given response
     *
     * @param response - response to /sync request
     */
    sendOrQueueSyncResponse(response: object): void;
}

enum SyncResponderState {
    IDLE,
    WAITING_FOR_REQUEST,
    WAITING_FOR_RESPONSE,
}

/** SyncResponder: An object which intercepts `/sync` fetches via fetch-mock.
 *
 * Two modes are possible:
 *  * A response can be queued up; the next call to `/sync` will return it.
 *  * If a call to `/sync` arrives before a response is queued, it will block until a call to {@link #sendOrQueueSyncResponse}.
 */
export class SyncResponder implements ISyncResponder {
    private readonly debug: Debugger;
    private state: SyncResponderState = SyncResponderState.IDLE;

    /*
     * properties that are only valid in WAITING_FOR_REQUEST
     */

    /** the response to be sent when the request is made */
    private pendingResponse: object | null = null;

    /*
     * properties that are only valid in WAITING_FOR_RESPONSE
     */

    /** a callback to be called with a response once one is registered.
     *
     * It will release the /sync request and update the state.
     */
    private onResponseReceived: ((response: object) => void) | null = null;

    /**
     * Construct a new SyncResponder.
     *
     * It will immediately register an intercept of `/sync` requests for the given homeserverUrl.
     * Only /sync requests made to this server will be intercepted: this allows a single test to use more than one
     * client and have overlapping /sync requests.
     *
     * @param homeserverUrl - the Homeserver Url of the client under test.
     */
    public constructor(homeserverUrl: string) {
        this.debug = debugFunc(`sync-responder:[${homeserverUrl}]`);
        fetchMock.get("begin:" + new URL("/_matrix/client/r0/sync?", homeserverUrl).toString(), (_url, _options) =>
            this.onSyncRequest(),
        );
    }

    private async onSyncRequest(): Promise<MockResponse> {
        switch (this.state) {
            case SyncResponderState.IDLE: {
                this.debug("Got /sync request: waiting for response to be ready");
                const res = await new Promise<object>((resolve) => {
                    this.onResponseReceived = resolve;
                    this.state = SyncResponderState.WAITING_FOR_RESPONSE;
                });
                this.debug("Responding to /sync");
                this.state = SyncResponderState.IDLE;
                this.onResponseReceived = null;
                return res;
            }

            case SyncResponderState.WAITING_FOR_REQUEST: {
                this.debug("Got /sync request: responding immediately with queued response");
                const res = this.pendingResponse!;
                this.state = SyncResponderState.IDLE;
                this.pendingResponse = null;
                return res;
            }

            default:
                // we must already be in WAITING_FOR_RESPONSE, ie we already have a /sync request in progress
                throw new Error(`Got unexpected /sync request in state ${this.state}`);
        }
    }

    /** Next time we see a sync request (or immediately, if there is one waiting), send the given response
     *
     * @param response - response to /sync request
     */
    public sendOrQueueSyncResponse(response: object): void {
        switch (this.state) {
            case SyncResponderState.IDLE:
                this.pendingResponse = response;
                this.state = SyncResponderState.WAITING_FOR_REQUEST;
                break;

            case SyncResponderState.WAITING_FOR_RESPONSE:
                this.onResponseReceived!(response);
                break;

            default:
                // we already have a response queued
                throw new Error(`Cannot queue more than one /sync response`);
        }
    }
}
