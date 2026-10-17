/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { encodeUnpaddedBase64 } from "matrix-js-sdk/src/matrix";

import * as StorageAccess from "../utils/StorageAccess";
import { persistTokens } from "../utils/tokens/tokens";
import { encryptPickleKey } from "../utils/tokens/pickling";

const USER_ID = "@alice:example.com";
const DEVICE_ID = "ABCDEFG";

type Listener = (event: any) => void;

/**
 * The listeners the service worker registered on the global scope, keyed by event type.
 *
 * Everything below the `fetch` handler is module-private, so driving that handler is the only way
 * into the token-reading code. We capture the registrations rather than dispatching real events so
 * that the `message` exchange with the "tab" can be answered synchronously.
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

describe("serviceworker", () => {
    /** Stand-in for IndexedDB, keyed by table and then by key. */
    let storage: Record<string, Record<string, unknown>>;
    let fetchSpy: ReturnType<typeof vi.fn>;
    /**
     * A different homeserver for each test: the module caches which origins support authenticated
     * media for two hours, and there is no way to reach into that cache to clear it.
     */
    let homeserver: string;
    let mediaUrl: string;
    let homeserverCount = 0;

    /** Stands in for the tab which the service worker asks for the user ID and device ID. */
    const tab = {
        postMessage: vi.fn(({ responseKey }: { responseKey: string }) => {
            emit("message", { data: { responseKey, userId: USER_ID, deviceId: DEVICE_ID, homeserver } });
        }),
    };

    beforeEach(() => {
        vi.clearAllMocks();

        storage = {};
        vi.spyOn(StorageAccess, "idbSave").mockImplementation(async (table, key, data) => {
            storage[table] = { ...storage[table], [String(key)]: data };
        });
        vi.spyOn(StorageAccess, "idbLoad").mockImplementation(async (table, key) => storage[table]?.[String(key)]);

        homeserver = `https://hs-${++homeserverCount}.example.com`;
        mediaUrl = `${homeserver}/_matrix/media/v3/download/example.com/abc123`;

        fetchSpy = vi.fn(async (input: URL | string) => {
            if (input.toString().endsWith("/_matrix/client/versions")) {
                return { json: async () => ({ versions: ["v1.11"] }) };
            }
            return new Response("media");
        });
        vi.stubGlobal("fetch", fetchSpy);
        vi.stubGlobal("clients", { get: vi.fn().mockResolvedValue(tab) });

        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    /**
     * Drive the module's `fetch` handler for a media download, and return the request it ultimately
     * made to the network.
     */
    async function interceptMediaRequest(): Promise<{ url: string; init?: RequestInit }> {
        let responded: Promise<Response> | undefined;
        emit("fetch", {
            request: { method: "GET", url: mediaUrl },
            clientId: "client-1",
            respondWith: (response: Promise<Response>) => {
                responded = response;
            },
        });

        expect(responded).toBeDefined();
        await responded;

        const [url, init] = fetchSpy.mock.calls.at(-1)!;
        return { url: String(url), init };
    }

    /** The error which the last failed rewrite attempt reported, unwrapped from its wrapper. */
    function lastRewriteFailureCause(): unknown {
        const [, error] = vi.mocked(console.error).mock.calls.at(-1)!;
        return (error as Error).cause;
    }

    /** Store a pickle key for our user/device, and return it in the form callers use to encrypt. */
    async function storePickleKey(): Promise<string> {
        const rawPickleKey = new Uint8Array(32);
        crypto.getRandomValues(rawPickleKey);
        await StorageAccess.idbSave(
            "pickleKey",
            [USER_ID, DEVICE_ID],
            (await encryptPickleKey(rawPickleKey, USER_ID, DEVICE_ID))!,
        );
        return encodeUnpaddedBase64(rawPickleKey);
    }

    it("passes the request through unauthenticated when there is no access token stored", async () => {
        const { url, init } = await interceptMediaRequest();

        // Unable to authenticate, we must leave the URL alone rather than rewrite it to an endpoint
        // which requires the token we don't have.
        expect(url).toEqual(mediaUrl);
        expect(init).toBeUndefined();
        expect(lastRewriteFailureCause()).toMatchObject({ message: "no access token in storage" });
    });

    it("authenticates the request with an access token which was stored encrypted", async () => {
        await persistTokens(await storePickleKey(), { accessToken: "encrypted_token" });

        const { url, init } = await interceptMediaRequest();

        expect(url).toEqual(`${homeserver}/_matrix/client/v1/media/download/example.com/abc123`);
        expect(init).toEqual({ headers: { Authorization: `Bearer encrypted_token` } });
    });

    it("authenticates the request with an access token which was stored unencrypted", async () => {
        // A session which was set up while no pickle key was available stores the token as a plain
        // string, so there is nothing to decrypt and no pickle key needed to read it.
        await persistTokens(undefined, { accessToken: "plain_text_token" });

        const { url, init } = await interceptMediaRequest();

        expect(url).toEqual(`${homeserver}/_matrix/client/v1/media/download/example.com/abc123`);
        expect(init).toEqual({ headers: { Authorization: `Bearer plain_text_token` } });
    });

    it("passes the request through unauthenticated when the token is encrypted but the pickle key is missing", async () => {
        // Encrypt the token, then remove the pickle key from  storage, as happens when IndexedDB
        // loses the pickle key table but not the account table.
        const pickleKey = await storePickleKey();
        delete storage["pickleKey"];
        await persistTokens(pickleKey, { accessToken: "encrypted_token" });

        const { url, init } = await interceptMediaRequest();

        expect(url).toEqual(mediaUrl);
        expect(init).toBeUndefined();
        expect(lastRewriteFailureCause()).toMatchObject({ message: "no pickle key found" });
    });
});
