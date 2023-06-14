/*
Copyright 2022 Dominik Henneke
Copyright 2022 Nordeck IT + Consulting GmbH.

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

import HttpBackend from "matrix-mock-request";

import { Direction, MatrixClient, MatrixScheduler } from "../../src/matrix";
import { TestClient } from "../TestClient";

describe("MatrixClient relations", () => {
    const userId = "@alice:localhost";
    const accessToken = "aseukfgwef";
    const roomId = "!room:here";
    let client: MatrixClient | undefined;
    let httpBackend: HttpBackend | undefined;

    const setupTests = (): [MatrixClient, HttpBackend] => {
        const scheduler = new MatrixScheduler();
        const testClient = new TestClient(userId, "DEVICE", accessToken, undefined, { scheduler });
        const httpBackend = testClient.httpBackend;
        const client = testClient.client;

        return [client, httpBackend];
    };

    beforeEach(() => {
        [client, httpBackend] = setupTests();
    });

    afterEach(() => {
        httpBackend!.verifyNoOutstandingExpectation();
        return httpBackend!.stop();
    });

    it("should read related events with the default options", async () => {
        const response = client!.relations(roomId, "$event-0", null, null);

        httpBackend!.when("GET", "/rooms/!room%3Ahere/event/%24event-0").respond(200, null);
        httpBackend!
            .when("GET", "/_matrix/client/v1/rooms/!room%3Ahere/relations/%24event-0?dir=b")
            .respond(200, { chunk: [], next_batch: "NEXT" });

        await httpBackend!.flushAllExpected();

        expect(await response).toEqual({ events: [], nextBatch: "NEXT", originalEvent: null, prevBatch: null });
    });

    it("should read related events with relation type", async () => {
        const response = client!.relations(roomId, "$event-0", "m.reference", null);

        httpBackend!.when("GET", "/rooms/!room%3Ahere/event/%24event-0").respond(200, null);
        httpBackend!
            .when("GET", "/_matrix/client/v1/rooms/!room%3Ahere/relations/%24event-0/m.reference?dir=b")
            .respond(200, { chunk: [], next_batch: "NEXT" });

        await httpBackend!.flushAllExpected();

        expect(await response).toEqual({ events: [], nextBatch: "NEXT", originalEvent: null, prevBatch: null });
    });

    it("should read related events with relation type and event type", async () => {
        const response = client!.relations(roomId, "$event-0", "m.reference", "m.room.message");

        httpBackend!.when("GET", "/rooms/!room%3Ahere/event/%24event-0").respond(200, null);
        httpBackend!
            .when("GET", "/_matrix/client/v1/rooms/!room%3Ahere/relations/%24event-0/m.reference/m.room.message?dir=b")
            .respond(200, { chunk: [], next_batch: "NEXT" });

        await httpBackend!.flushAllExpected();

        expect(await response).toEqual({ events: [], nextBatch: "NEXT", originalEvent: null, prevBatch: null });
    });

    it("should read related events with custom options", async () => {
        const response = client!.relations(roomId, "$event-0", null, null, {
            dir: Direction.Forward,
            from: "FROM",
            limit: 10,
            to: "TO",
        });

        httpBackend!.when("GET", "/rooms/!room%3Ahere/event/%24event-0").respond(200, null);
        httpBackend!
            .when("GET", "/_matrix/client/v1/rooms/!room%3Ahere/relations/%24event-0?dir=f&from=FROM&limit=10&to=TO")
            .respond(200, { chunk: [], next_batch: "NEXT" });

        await httpBackend!.flushAllExpected();

        expect(await response).toEqual({ events: [], nextBatch: "NEXT", originalEvent: null, prevBatch: null });
    });

    it("should use default direction in the fetchRelations endpoint", async () => {
        const response = client!.fetchRelations(roomId, "$event-0", null, null);

        httpBackend!
            .when("GET", "/rooms/!room%3Ahere/relations/%24event-0?dir=b")
            .respond(200, { chunk: [], next_batch: "NEXT" });

        await httpBackend!.flushAllExpected();

        expect(await response).toEqual({ chunk: [], next_batch: "NEXT" });
    });
});
