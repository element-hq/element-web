/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { stubClient } from "test-utils";

import { ClientApi } from "./ClientApi";
import { Room } from "./models/Room";
import { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { MatrixClientPeg } from "../MatrixClientPeg";

describe("ClientApi", () => {
    it("should return module room from getRoom()", () => {
        stubClient();
        const client = new ClientApi(new MatrixDispatcher());
        const moduleRoom = client.getRoom("!foo:matrix.org");
        expect(moduleRoom).toBeInstanceOf(Room);
        expect(moduleRoom?.id).toStrictEqual("!foo:matrix.org");
    });

    // Both methods share the header handling; the homeserver check is covered separately below.
    describe.each(["doAuthenticatedRequest", "doUnsafeAuthenticatedRequest"] as const)("%s", (method) => {
        const url = "https://example.org/_matrix/client/v3/foo";
        let fetchSpy: MockInstance<typeof fetch>;

        beforeEach(() => {
            const client = stubClient();
            vi.mocked(client.getAccessToken).mockReturnValue("syt_token");
            vi.mocked(client.getHomeserverUrl).mockReturnValue("https://example.org");
            fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
        });

        afterEach(() => {
            fetchSpy.mockRestore();
        });

        /** Get the request passed to the last fetch call, checking no separate init could override it. */
        function sentRequest(): Request {
            expect(fetchSpy.mock.lastCall).toHaveLength(1);
            return fetchSpy.mock.lastCall?.[0] as Request;
        }

        it("should add the header to a string URL", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            await api[method](url);
            expect(sentRequest().url).toStrictEqual(url);
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
        });

        it("should add the header to a URL object input", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            await api[method](new URL(url));
            expect(sentRequest().url).toStrictEqual(url);
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
        });

        it("should pass through other init options", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            await api[method](url, { method: "POST", body: "hello" });
            expect(sentRequest().method).toStrictEqual("POST");
            await expect(sentRequest().text()).resolves.toStrictEqual("hello");
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
        });

        it.each([
            ["a Headers object", () => new Headers({ "X-Foo": "bar" })],
            ["an array", (): [string, string][] => [["X-Foo", "bar"]]],
            ["a plain object", (): Record<string, string> => ({ "X-Foo": "bar" })],
        ])("should add the header without changing existing headers given as %s", async (_, makeHeaders) => {
            const api = new ClientApi(new MatrixDispatcher());
            const headers = makeHeaders();
            await api[method](url, { headers });
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
            expect(sentRequest().headers.get("X-Foo")).toStrictEqual("bar");
            expect(headers).toStrictEqual(makeHeaders());
        });

        it("should add the header to a Request input without changing it", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            const request = new Request(url, { headers: { "X-Foo": "bar" } });
            await api[method](request);
            expect(sentRequest()).not.toBe(request);
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
            expect(sentRequest().headers.get("X-Foo")).toStrictEqual("bar");
            expect(request.headers.has("Authorization")).toBe(false);
        });

        it("should add the header when a Request input has its headers replaced by init", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            const request = new Request(url, { headers: { "X-Foo": "bar" } });
            await api[method](request, { headers: { "X-Baz": "qux" } });
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
            expect(sentRequest().headers.get("X-Baz")).toStrictEqual("qux");
            // Matches fetch: headers in init replace those on the Request.
            expect(sentRequest().headers.has("X-Foo")).toBe(false);
        });

        it.each([
            ["init headers", (): [RequestInfo, RequestInit] => [url, { headers: { authorization: "Bearer other" } }]],
            [
                "a Request input",
                (): [RequestInfo, RequestInit] => [
                    new Request(url, { headers: { Authorization: "Bearer other" } }),
                    {},
                ],
            ],
        ])("should refuse to make the request if %s already has an Authorization header", async (_, makeArgs) => {
            const api = new ClientApi(new MatrixDispatcher());
            await expect(api[method](...makeArgs())).rejects.toThrow("already has an Authorization");
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("should return the response from fetch", async () => {
            const response = new Response("body");
            fetchSpy.mockResolvedValue(response);
            const api = new ClientApi(new MatrixDispatcher());
            await expect(api[method](url)).resolves.toBe(response);
        });

        it("should refuse to make the request if the client has no access token", async () => {
            vi.mocked(MatrixClientPeg.safeGet().getAccessToken).mockReturnValue(null);
            const api = new ClientApi(new MatrixDispatcher());
            await expect(api[method](url)).rejects.toThrow("Client has no token");
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("should reject if the client isn't ready", async () => {
            vi.spyOn(MatrixClientPeg, "safeGet").mockImplementation(() => {
                throw new Error("not logged in");
            });
            const api = new ClientApi(new MatrixDispatcher());
            await expect(api[method](url)).rejects.toThrow("not logged in");
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    describe("homeserver check", () => {
        let fetchSpy: MockInstance<typeof fetch>;

        beforeEach(() => {
            const client = stubClient();
            vi.mocked(client.getAccessToken).mockReturnValue("syt_token");
            vi.mocked(client.getHomeserverUrl).mockReturnValue("https://matrix.example.org/base");
            fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
        });

        afterEach(() => {
            fetchSpy.mockRestore();
        });

        it.each([
            ["a path under the homeserver URL", "https://matrix.example.org/base/_matrix/client/v3/foo"],
            ["another path on the homeserver origin", "https://matrix.example.org/_matrix/client/v3/foo"],
            ["a Request to the homeserver", new Request("https://matrix.example.org/_matrix/client/v3/foo")],
        ])("doAuthenticatedRequest should allow %s", async (_, input) => {
            const api = new ClientApi(new MatrixDispatcher());
            await api.doAuthenticatedRequest(input);
            const sent = fetchSpy.mock.lastCall?.[0] as Request;
            expect(sent.headers.get("Authorization")).toStrictEqual("Bearer syt_token");
        });

        it.each([
            ["another host", "https://evil.example.com/_matrix/client/v3/foo"],
            ["a host starting with the homeserver host", "https://matrix.example.org.evil.com/_matrix/client/v3/foo"],
            ["another port", "https://matrix.example.org:8448/_matrix/client/v3/foo"],
            ["another scheme", "http://matrix.example.org/_matrix/client/v3/foo"],
            ["a URL object for another host", new URL("https://evil.example.com/foo")],
            ["a Request to another host", new Request("https://evil.example.com/foo")],
        ])("doAuthenticatedRequest should refuse %s", async (_, input) => {
            const api = new ClientApi(new MatrixDispatcher());
            await expect(api.doAuthenticatedRequest(input)).rejects.toThrow("not to the homeserver");
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("doUnsafeAuthenticatedRequest should allow another host", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            await api.doUnsafeAuthenticatedRequest("https://evil.example.com/foo");
            const sent = fetchSpy.mock.lastCall?.[0] as Request;
            expect(sent.url).toStrictEqual("https://evil.example.com/foo");
            expect(sent.headers.get("Authorization")).toStrictEqual("Bearer syt_token");
        });
    });

    describe("waitForClientStarted", () => {
        it("should resolve once the client has started", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = new ClientApi(dispatcher);
            const onStarted = vi.fn();
            void client.waitForClientStarted().then(onStarted);

            await Promise.resolve();
            expect(onStarted).not.toHaveBeenCalled();

            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
        });

        it("should resolve immediately if the client has already started", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = new ClientApi(dispatcher);
            dispatcher.dispatch({ action: Action.ClientStarted }, true);

            await expect(client.waitForClientStarted()).resolves.toBeUndefined();
        });

        it("should wait for the next start after logout", async () => {
            const dispatcher = new MatrixDispatcher();
            const client = new ClientApi(dispatcher);
            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            dispatcher.dispatch({ action: Action.OnLoggedOut }, true);

            const onStarted = vi.fn();
            void client.waitForClientStarted().then(onStarted);
            await Promise.resolve();
            expect(onStarted).not.toHaveBeenCalled();

            dispatcher.dispatch({ action: Action.ClientStarted }, true);
            await vi.waitFor(() => expect(onStarted).toHaveBeenCalled());
        });
    });
});
