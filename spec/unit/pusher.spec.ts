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

import MockHttpBackend from "matrix-mock-request";

import { MatrixClient, PUSHER_ENABLED } from "../../src/matrix";
import { mkPusher } from "../test-utils/test-utils";

const realSetTimeout = setTimeout;
function flushPromises() {
    return new Promise((r) => {
        realSetTimeout(r, 1);
    });
}

let client: MatrixClient;
let httpBackend: MockHttpBackend;

describe("Pushers", () => {
    beforeEach(() => {
        httpBackend = new MockHttpBackend();
        client = new MatrixClient({
            baseUrl: "https://my.home.server",
            accessToken: "my.access.token",
            fetchFn: httpBackend.fetchFn as typeof global.fetch,
        });
    });

    describe("supports remotely toggling push notifications", () => {
        it("migration support when connecting to a legacy homeserver", async () => {
            httpBackend.when("GET", "/_matrix/client/versions").respond(200, {
                unstable_features: {
                    "org.matrix.msc3881": false,
                },
            });
            httpBackend.when("GET", "/pushers").respond(200, {
                pushers: [
                    mkPusher(),
                    mkPusher({ [PUSHER_ENABLED.name]: true }),
                    mkPusher({ [PUSHER_ENABLED.name]: false }),
                ],
            });

            const promise = client.getPushers();

            await httpBackend.flushAllExpected();
            await flushPromises();

            const response = await promise;

            expect(response.pushers[0][PUSHER_ENABLED.name]).toBe(true);
            expect(response.pushers[1][PUSHER_ENABLED.name]).toBe(true);
            expect(response.pushers[2][PUSHER_ENABLED.name]).toBe(false);
        });
    });
});
