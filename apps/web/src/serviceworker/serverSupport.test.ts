/*
Copyright 2026 inblock.io

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

// Tests for the service worker's check of whether the homeserver supports authenticated media (the `/versions`
// request in `index.ts`).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import * as StorageAccess from "../utils/StorageAccess";
import { persistTokens } from "../utils/tokens/tokens";

const USER_ID = "@alice:example.com";
const DEVICE_ID = "ABCDEFG";
const ACCESS_TOKEN = "stored_access_token";

type Listener = (event: any) => void;

/**
 * The listeners the service worker registered on the global scope, keyed by event type.
 *
 * Everything below the `fetch` handler is module-private, so driving that handler is the only way in. We capture
 * the registrations rather than dispatching real events so that the `message` exchange with the "tab" can be
 * answered synchronously.
 */
const listeners = new Map<string, Set<Listener>>();

vi.spyOn(global, "addEventListener").mockImplementation(((type: string, listener: Listener) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(listener);
}) as typeof global.addEventListener);

vi.spyOn(global, "removeEventListener").mockImplementation(((type: string, listener: Listener) => {
    listeners.get(type)?.delete(listener);
}) as typeof global.removeEventListener);

// Importing the service worker registers its listeners, via the spies above.
await import("./index");

function emit(type: string, event: unknown): void {
    for (const listener of listeners.get(type) ?? []) {
        listener(event);
    }
}

describe("serviceworker authenticated media support check", () => {
    /** Stand-in for IndexedDB, keyed by table and then by key. */
    let storage: Record<string, Record<string, unknown>>;
    /**
     * A different homeserver for each test: the module caches which origins support authenticated media for two
     * hours, and there is no way to reach into that cache to clear it.
     */
    let homeserver: string;
    let homeserverCount = 0;
    /** Answers the service worker's `/versions` requests. `authenticated` is whether it sent a token. */
    let versionsResponse: (authenticated: boolean) => Response | Promise<Response>;
    /** Every request the service worker sent to the network, in order. */
    let requests: { url: string; token?: string }[];

    /** Stands in for the tab which the service worker asks for the user ID and device ID. */
    const tab = {
        postMessage: vi.fn(({ responseKey }: { responseKey: string }) => {
            emit("message", { data: { responseKey, userId: USER_ID, deviceId: DEVICE_ID, homeserver } });
        }),
    };

    const supportsAuthenticatedMedia = (): Response => new Response(JSON.stringify({ versions: ["v1.11"] }));
    const versionsRequests = (): { url: string; token?: string }[] =>
        requests.filter((r) => r.url.endsWith("/_matrix/client/versions"));
    const mediaRequests = (): { url: string; token?: string }[] =>
        requests.filter((r) => !r.url.endsWith("/_matrix/client/versions"));

    beforeEach(async () => {
        storage = {};
        vi.spyOn(StorageAccess, "idbSave").mockImplementation(async (table, key, data) => {
            storage[table] = { ...storage[table], [String(key)]: data };
        });
        vi.spyOn(StorageAccess, "idbLoad").mockImplementation(async (table, key) => storage[table]?.[String(key)]);

        homeserver = `https://hs-${++homeserverCount}.example.com`;
        requests = [];
        versionsResponse = supportsAuthenticatedMedia;
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: URL | string, init?: RequestInit) => {
                const url = input.toString();
                const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
                const token = authorization?.replace(/^Bearer /, "");
                requests.push({ url, token });
                if (url.endsWith("/_matrix/client/versions")) return versionsResponse(!!token);
                return new Response("media");
            }),
        );
        vi.stubGlobal("clients", { get: vi.fn().mockResolvedValue(tab) });

        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});

        await persistTokens(undefined, { accessToken: ACCESS_TOKEN });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /** Drive the module's `fetch` handler for a media download, and wait for its response. */
    function interceptMediaRequest(): Promise<Response> {
        let responded: Promise<Response> | undefined;
        emit("fetch", {
            request: { method: "GET", url: `${homeserver}/_matrix/media/v3/download/example.com/abc123` },
            clientId: "client-1",
            respondWith: (response: Promise<Response>) => {
                responded = response;
            },
        });
        expect(responded).toBeDefined();
        return responded!;
    }

    it("uses authenticated media when the server supports it", async () => {
        await interceptMediaRequest();

        expect(versionsRequests()).toEqual([{ url: `${homeserver}/_matrix/client/versions`, token: ACCESS_TOKEN }]);
        expect(mediaRequests()).toEqual([
            { url: `${homeserver}/_matrix/client/v1/media/download/example.com/abc123`, token: ACCESS_TOKEN },
        ]);
    });

    it("does not cache a server error, and checks again on the next request", async () => {
        versionsResponse = () => new Response("Bad gateway", { status: 502 });

        await interceptMediaRequest();

        // As before, the request that hit the failure goes out unchanged and without the token.
        expect(mediaRequests()).toEqual([
            { url: `${homeserver}/_matrix/media/v3/download/example.com/abc123`, token: undefined },
        ]);
        expect(console.error).toHaveBeenCalledWith(
            "SW: Error in request rewrite.",
            expect.objectContaining({ message: expect.stringContaining("not caching server support") }),
        );

        versionsResponse = supportsAuthenticatedMedia;
        await interceptMediaRequest();

        expect(versionsRequests()).toHaveLength(2);
        expect(mediaRequests()[1]).toEqual({
            url: `${homeserver}/_matrix/client/v1/media/download/example.com/abc123`,
            token: ACCESS_TOKEN,
        });
    });

    it("does not cache a successful response without a list of versions", async () => {
        versionsResponse = () => new Response(JSON.stringify({ unstable_features: {} }));

        await interceptMediaRequest();
        expect(mediaRequests()[0].url).toEqual(`${homeserver}/_matrix/media/v3/download/example.com/abc123`);

        versionsResponse = supportsAuthenticatedMedia;
        await interceptMediaRequest();

        expect(versionsRequests()).toHaveLength(2);
        expect(mediaRequests()[1].url).toEqual(`${homeserver}/_matrix/client/v1/media/download/example.com/abc123`);
    });

    it("caches a server without authenticated media support", async () => {
        versionsResponse = () => new Response(JSON.stringify({ versions: ["v1.10"] }));

        await interceptMediaRequest();
        await interceptMediaRequest();

        expect(versionsRequests()).toHaveLength(1);
        expect(mediaRequests().map((r) => r.url)).toEqual([
            `${homeserver}/_matrix/media/v3/download/example.com/abc123`,
            `${homeserver}/_matrix/media/v3/download/example.com/abc123`,
        ]);
    });
});
