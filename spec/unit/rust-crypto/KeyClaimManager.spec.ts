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

import * as RustSdkCryptoJs from "@matrix-org/matrix-sdk-crypto-js";
import fetchMock from "fetch-mock-jest";
import { Mocked } from "jest-mock";
import { KeysClaimRequest, UserId } from "@matrix-org/matrix-sdk-crypto-js";

import { OutgoingRequestProcessor } from "../../../src/rust-crypto/OutgoingRequestProcessor";
import { KeyClaimManager } from "../../../src/rust-crypto/KeyClaimManager";
import { TypedEventEmitter } from "../../../src/models/typed-event-emitter";
import { HttpApiEvent, HttpApiEventHandlerMap, MatrixHttpApi } from "../../../src";

afterEach(() => {
    fetchMock.mockReset();
});

describe("KeyClaimManager", () => {
    /* for these tests, we connect a KeyClaimManager to a mock OlmMachine, and a real OutgoingRequestProcessor
     * (which is connected to a mock fetch implementation)
     */

    /** the KeyClaimManager implementation under test */
    let keyClaimManager: KeyClaimManager;

    /** a mocked-up OlmMachine which the OutgoingRequestProcessor and KeyClaimManager are connected to */
    let olmMachine: Mocked<RustSdkCryptoJs.OlmMachine>;

    beforeEach(async () => {
        const dummyEventEmitter = new TypedEventEmitter<HttpApiEvent, HttpApiEventHandlerMap>();
        const httpApi = new MatrixHttpApi(dummyEventEmitter, {
            baseUrl: "https://example.com",
            prefix: "/_matrix",
            onlyData: true,
        });

        olmMachine = {
            getMissingSessions: jest.fn(),
            markRequestAsSent: jest.fn(),
        } as unknown as Mocked<RustSdkCryptoJs.OlmMachine>;

        const outgoingRequestProcessor = new OutgoingRequestProcessor(olmMachine, httpApi);

        keyClaimManager = new KeyClaimManager(olmMachine, outgoingRequestProcessor);
    });

    /**
     * Returns a promise which resolve once olmMachine.markRequestAsSent is called.
     *
     * The call itself will block initially.
     *
     * The promise returned by this function yields a callback function, which should be called to unblock the
     * markRequestAsSent call.
     */
    function awaitCallToMarkRequestAsSent(): Promise<() => void> {
        return new Promise<() => void>((resolveCalledPromise, _reject) => {
            olmMachine.markRequestAsSent.mockImplementationOnce(async () => {
                // the mock implementation returns a promise...
                const completePromise = new Promise<void>((resolveCompletePromise, _reject) => {
                    // ...  and we now resolve the original promise with the resolver for that second promise.
                    resolveCalledPromise(resolveCompletePromise);
                });
                return completePromise;
            });
        });
    }

    it("should claim missing keys", async () => {
        const u1 = new UserId("@alice:example.com");
        const u2 = new UserId("@bob:example.com");

        // stub out olmMachine.getMissingSessions(), with a result indicating that it needs a keyclaim
        const keysClaimRequest = new KeysClaimRequest("1234", '{ "k1": "v1" }');
        olmMachine.getMissingSessions.mockResolvedValueOnce(keysClaimRequest);

        // have the claim request return a 200
        fetchMock.postOnce("https://example.com/_matrix/client/v3/keys/claim", '{ "k": "v" }');

        // also stub out olmMachine.markRequestAsSent
        olmMachine.markRequestAsSent.mockResolvedValueOnce(undefined);

        // fire off the request
        await keyClaimManager.ensureSessionsForUsers([u1, u2]);

        // check that all the calls were made
        expect(olmMachine.getMissingSessions).toHaveBeenCalledWith([u1, u2]);
        expect(fetchMock).toHaveFetched("https://example.com/_matrix/client/v3/keys/claim", {
            method: "POST",
            body: { k1: "v1" },
        });
        expect(olmMachine.markRequestAsSent).toHaveBeenCalledWith("1234", keysClaimRequest.type, '{ "k": "v" }');
    });

    it("should wait for previous claims to complete before making another", async () => {
        const u1 = new UserId("@alice:example.com");
        const u2 = new UserId("@bob:example.com");

        // stub out olmMachine.getMissingSessions(), with a result indicating that it needs a keyclaim
        const keysClaimRequest = new KeysClaimRequest("1234", '{ "k1": "v1" }');
        olmMachine.getMissingSessions.mockResolvedValue(keysClaimRequest);

        // have the claim request return a 200
        fetchMock.post("https://example.com/_matrix/client/v3/keys/claim", '{ "k": "v" }');

        // stub out olmMachine.markRequestAsSent, and have it block
        let markRequestAsSentPromise = awaitCallToMarkRequestAsSent();

        // fire off two requests, and keep track of whether their promises resolve
        let req1Resolved = false;
        keyClaimManager.ensureSessionsForUsers([u1]).then(() => {
            req1Resolved = true;
        });
        let req2Resolved = false;
        const req2 = keyClaimManager.ensureSessionsForUsers([u2]).then(() => {
            req2Resolved = true;
        });

        // now: wait for the (first) call to OlmMachine.markRequestAsSent
        let resolveMarkRequestAsSentCallback = await markRequestAsSentPromise;

        // at this point, there should have been a single call to getMissingSessions, and a single fetch; and neither
        // call to ensureSessionsAsUsers should have completed
        expect(olmMachine.getMissingSessions).toHaveBeenCalledWith([u1]);
        expect(olmMachine.getMissingSessions).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(req1Resolved).toBe(false);
        expect(req2Resolved).toBe(false);

        // await the next call to markRequestAsSent, and release the first one
        markRequestAsSentPromise = awaitCallToMarkRequestAsSent();
        resolveMarkRequestAsSentCallback();
        resolveMarkRequestAsSentCallback = await markRequestAsSentPromise;

        // the first request should now have completed, and we should have more calls and fetches
        expect(olmMachine.getMissingSessions).toHaveBeenCalledWith([u2]);
        expect(olmMachine.getMissingSessions).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(req1Resolved).toBe(true);
        expect(req2Resolved).toBe(false);

        // finally, release the second call to markRequestAsSent and check that the second request completes
        resolveMarkRequestAsSentCallback();
        await req2;
    });
});
