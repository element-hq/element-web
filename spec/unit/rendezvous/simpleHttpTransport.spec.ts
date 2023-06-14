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

import type { MatrixClient } from "../../../src";
import { RendezvousFailureReason } from "../../../src/rendezvous";
import { MSC3886SimpleHttpRendezvousTransport } from "../../../src/rendezvous/transports";

function makeMockClient(opts: { userId: string; deviceId: string; msc3886Enabled: boolean }): MatrixClient {
    return {
        doesServerSupportUnstableFeature(feature: string) {
            return Promise.resolve(opts.msc3886Enabled && feature === "org.matrix.msc3886");
        },
        getUserId() {
            return opts.userId;
        },
        getDeviceId() {
            return opts.deviceId;
        },
        requestLoginToken() {
            return Promise.resolve({ login_token: "token" });
        },
        baseUrl: "https://example.com",
    } as unknown as MatrixClient;
}

describe("SimpleHttpRendezvousTransport", function () {
    let httpBackend: MockHttpBackend;
    let fetchFn: typeof global.fetch;

    beforeEach(function () {
        httpBackend = new MockHttpBackend();
        fetchFn = httpBackend.fetchFn as typeof global.fetch;
    });

    async function postAndCheckLocation(
        msc3886Enabled: boolean,
        fallbackRzServer: string,
        locationResponse: string,
        expectedFinalLocation: string,
    ) {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({ client, fallbackRzServer, fetchFn });
        {
            // initial POST
            const expectedPostLocation = msc3886Enabled
                ? `${client.baseUrl}/_matrix/client/unstable/org.matrix.msc3886/rendezvous`
                : fallbackRzServer;

            const prom = simpleHttpTransport.send({});
            httpBackend.when("POST", expectedPostLocation).response = {
                body: null,
                response: {
                    statusCode: 201,
                    headers: {
                        location: locationResponse,
                    },
                },
            };
            await httpBackend.flush("");
            await prom;
        }
        const details = await simpleHttpTransport.details();
        expect(details.uri).toBe(expectedFinalLocation);

        {
            // first GET without etag
            const prom = simpleHttpTransport.receive();
            httpBackend.when("GET", expectedFinalLocation).response = {
                body: {},
                response: {
                    statusCode: 200,
                    headers: {
                        "content-type": "application/json",
                    },
                },
            };
            await httpBackend.flush("");
            expect(await prom).toEqual({});
            httpBackend.verifyNoOutstandingRequests();
            httpBackend.verifyNoOutstandingExpectation();
        }
    }
    it("should throw an error when no server available", function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({ client, fetchFn });
        expect(simpleHttpTransport.send({})).rejects.toThrow("Invalid rendezvous URI");
    });

    it("POST to fallback server", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        const prom = simpleHttpTransport.send({});
        httpBackend.when("POST", "https://fallbackserver/rz").response = {
            body: null,
            response: {
                statusCode: 201,
                headers: {
                    location: "https://fallbackserver/rz/123",
                },
            },
        };
        await httpBackend.flush("");
        expect(await prom).toStrictEqual(undefined);
    });

    it("POST with no location", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        const prom = simpleHttpTransport.send({});
        expect(prom).rejects.toThrow();
        httpBackend.when("POST", "https://fallbackserver/rz").response = {
            body: null,
            response: {
                statusCode: 201,
                headers: {},
            },
        };
        await httpBackend.flush("");
    });

    it("POST with absolute path response", async function () {
        await postAndCheckLocation(false, "https://fallbackserver/rz", "/123", "https://fallbackserver/123");
    });

    it("POST to built-in MSC3886 implementation", async function () {
        await postAndCheckLocation(
            true,
            "https://fallbackserver/rz",
            "123",
            "https://example.com/_matrix/client/unstable/org.matrix.msc3886/rendezvous/123",
        );
    });

    it("POST with relative path response including parent", async function () {
        await postAndCheckLocation(
            false,
            "https://fallbackserver/rz/abc",
            "../xyz/123",
            "https://fallbackserver/rz/xyz/123",
        );
    });

    it("POST to follow 307 to other server", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        const prom = simpleHttpTransport.send({});
        httpBackend.when("POST", "https://fallbackserver/rz").response = {
            body: null,
            response: {
                statusCode: 307,
                headers: {
                    location: "https://redirected.fallbackserver/rz",
                },
            },
        };
        httpBackend.when("POST", "https://redirected.fallbackserver/rz").response = {
            body: null,
            response: {
                statusCode: 201,
                headers: {
                    location: "https://redirected.fallbackserver/rz/123",
                    etag: "aaa",
                },
            },
        };
        await httpBackend.flush("");
        expect(await prom).toStrictEqual(undefined);
    });

    it("POST and GET", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        {
            // initial POST
            const prom = simpleHttpTransport.send({ foo: "baa" });
            httpBackend.when("POST", "https://fallbackserver/rz").check(({ headers, data }) => {
                expect(headers["content-type"]).toEqual("application/json");
                expect(data).toEqual({ foo: "baa" });
            }).response = {
                body: null,
                response: {
                    statusCode: 201,
                    headers: {
                        location: "https://fallbackserver/rz/123",
                    },
                },
            };
            await httpBackend.flush("");
            expect(await prom).toStrictEqual(undefined);
        }
        {
            // first GET without etag
            const prom = simpleHttpTransport.receive();
            httpBackend.when("GET", "https://fallbackserver/rz/123").response = {
                body: { foo: "baa" },
                response: {
                    statusCode: 200,
                    headers: {
                        "content-type": "application/json",
                        "etag": "aaa",
                    },
                },
            };
            await httpBackend.flush("");
            expect(await prom).toEqual({ foo: "baa" });
        }
        {
            // subsequent GET which should have etag from previous request
            const prom = simpleHttpTransport.receive();
            httpBackend.when("GET", "https://fallbackserver/rz/123").check(({ headers }) => {
                expect(headers["if-none-match"]).toEqual("aaa");
            }).response = {
                body: { foo: "baa" },
                response: {
                    statusCode: 200,
                    headers: {
                        "content-type": "application/json",
                        "etag": "bbb",
                    },
                },
            };
            await httpBackend.flush("");
            expect(await prom).toEqual({ foo: "baa" });
        }
    });

    it("POST and PUTs", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        {
            // initial POST
            const prom = simpleHttpTransport.send({ foo: "baa" });
            httpBackend.when("POST", "https://fallbackserver/rz").check(({ headers, data }) => {
                expect(headers["content-type"]).toEqual("application/json");
                expect(data).toEqual({ foo: "baa" });
            }).response = {
                body: null,
                response: {
                    statusCode: 201,
                    headers: {
                        location: "https://fallbackserver/rz/123",
                    },
                },
            };
            await httpBackend.flush("", 1);
            await prom;
        }
        {
            // first PUT without etag
            const prom = simpleHttpTransport.send({ a: "b" });
            httpBackend.when("PUT", "https://fallbackserver/rz/123").check(({ headers, data }) => {
                expect(headers["if-match"]).toBeUndefined();
                expect(data).toEqual({ a: "b" });
            }).response = {
                body: null,
                response: {
                    statusCode: 202,
                    headers: {
                        etag: "aaa",
                    },
                },
            };
            await httpBackend.flush("", 1);
            await prom;
        }
        {
            // subsequent PUT which should have etag from previous request
            const prom = simpleHttpTransport.send({ c: "d" });
            httpBackend.when("PUT", "https://fallbackserver/rz/123").check(({ headers }) => {
                expect(headers["if-match"]).toEqual("aaa");
            }).response = {
                body: null,
                response: {
                    statusCode: 202,
                    headers: {
                        etag: "bbb",
                    },
                },
            };
            await httpBackend.flush("", 1);
            await prom;
        }
    });

    it("POST and DELETE", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        {
            // Create
            const prom = simpleHttpTransport.send({ foo: "baa" });
            httpBackend.when("POST", "https://fallbackserver/rz").check(({ headers, data }) => {
                expect(headers["content-type"]).toEqual("application/json");
                expect(data).toEqual({ foo: "baa" });
            }).response = {
                body: null,
                response: {
                    statusCode: 201,
                    headers: {
                        location: "https://fallbackserver/rz/123",
                    },
                },
            };
            await httpBackend.flush("");
            expect(await prom).toStrictEqual(undefined);
        }
        {
            // Cancel
            const prom = simpleHttpTransport.cancel(RendezvousFailureReason.UserDeclined);
            httpBackend.when("DELETE", "https://fallbackserver/rz/123").response = {
                body: null,
                response: {
                    statusCode: 204,
                    headers: {},
                },
            };
            await httpBackend.flush("");
            await prom;
        }
    });

    it("details before ready", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        expect(simpleHttpTransport.details()).rejects.toThrow();
    });

    it("send after cancelled", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        await simpleHttpTransport.cancel(RendezvousFailureReason.UserDeclined);
        expect(simpleHttpTransport.send({})).resolves.toBeUndefined();
    });

    it("receive before ready", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
        });
        expect(simpleHttpTransport.receive()).rejects.toThrow();
    });

    it("404 failure callback", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const onFailure = jest.fn();
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
            onFailure,
        });

        expect(simpleHttpTransport.send({ foo: "baa" })).resolves.toBeUndefined();
        httpBackend.when("POST", "https://fallbackserver/rz").response = {
            body: null,
            response: {
                statusCode: 404,
                headers: {},
            },
        };
        await httpBackend.flush("", 1);
        expect(onFailure).toHaveBeenCalledWith(RendezvousFailureReason.Unknown);
    });

    it("404 failure callback mapped to expired", async function () {
        const client = makeMockClient({ userId: "@alice:example.com", deviceId: "DEVICEID", msc3886Enabled: false });
        const onFailure = jest.fn();
        const simpleHttpTransport = new MSC3886SimpleHttpRendezvousTransport({
            client,
            fallbackRzServer: "https://fallbackserver/rz",
            fetchFn,
            onFailure,
        });

        {
            // initial POST
            const prom = simpleHttpTransport.send({ foo: "baa" });
            httpBackend.when("POST", "https://fallbackserver/rz").response = {
                body: null,
                response: {
                    statusCode: 201,
                    headers: {
                        location: "https://fallbackserver/rz/123",
                        expires: "Thu, 01 Jan 1970 00:00:00 GMT",
                    },
                },
            };
            await httpBackend.flush("");
            await prom;
        }
        {
            // GET with 404 to simulate expiry
            expect(simpleHttpTransport.receive()).resolves.toBeUndefined();
            httpBackend.when("GET", "https://fallbackserver/rz/123").response = {
                body: { foo: "baa" },
                response: {
                    statusCode: 404,
                    headers: {},
                },
            };
            await httpBackend.flush("");
            expect(onFailure).toHaveBeenCalledWith(RendezvousFailureReason.Expired);
        }
    });
});
