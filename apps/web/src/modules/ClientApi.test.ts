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

    describe("doAuthenticatedRequest", () => {
        const url = "https://example.org/_matrix/client/v3/foo";
        let fetchSpy: MockInstance<typeof fetch>;

        beforeEach(() => {
            const client = stubClient();
            vi.mocked(client.getAccessToken).mockReturnValue("syt_token");
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
            await api.doAuthenticatedRequest(url);
            expect(sentRequest().url).toStrictEqual(url);
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
        });

        it("should add the header to a URL object input", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            await api.doAuthenticatedRequest(new URL(url));
            expect(sentRequest().url).toStrictEqual(url);
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
        });

        it("should pass through other init options", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            await api.doAuthenticatedRequest(url, { method: "POST", body: "hello" });
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
            await api.doAuthenticatedRequest(url, { headers });
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
            expect(sentRequest().headers.get("X-Foo")).toStrictEqual("bar");
            expect(headers).toStrictEqual(makeHeaders());
        });

        it("should add the header to a Request input without changing it", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            const request = new Request(url, { headers: { "X-Foo": "bar" } });
            await api.doAuthenticatedRequest(request);
            expect(sentRequest()).not.toBe(request);
            expect(sentRequest().headers.get("Authorization")).toStrictEqual("Bearer syt_token");
            expect(sentRequest().headers.get("X-Foo")).toStrictEqual("bar");
            expect(request.headers.has("Authorization")).toBe(false);
        });

        it("should add the header when a Request input has its headers replaced by init", async () => {
            const api = new ClientApi(new MatrixDispatcher());
            const request = new Request(url, { headers: { "X-Foo": "bar" } });
            await api.doAuthenticatedRequest(request, { headers: { "X-Baz": "qux" } });
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
            await expect(api.doAuthenticatedRequest(...makeArgs())).rejects.toThrow("already has an Authorization");
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("should return the response from fetch", async () => {
            const response = new Response("body");
            fetchSpy.mockResolvedValue(response);
            const api = new ClientApi(new MatrixDispatcher());
            await expect(api.doAuthenticatedRequest(url)).resolves.toBe(response);
        });

        it("should refuse to make the request if the client has no access token", async () => {
            vi.mocked(MatrixClientPeg.safeGet().getAccessToken).mockReturnValue(null);
            const api = new ClientApi(new MatrixDispatcher());
            await expect(api.doAuthenticatedRequest(url)).rejects.toThrow("Client has no token");
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("should reject if the client isn't ready", async () => {
            vi.spyOn(MatrixClientPeg, "safeGet").mockImplementation(() => {
                throw new Error("not logged in");
            });
            const api = new ClientApi(new MatrixDispatcher());
            await expect(api.doAuthenticatedRequest(url)).rejects.toThrow("not logged in");
            expect(fetchSpy).not.toHaveBeenCalled();
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
