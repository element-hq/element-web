/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { stubClient } from "test-utils";

import { fetchAuthenticatedMedia, toAuthenticatedMediaUrl } from "./authenticatedMedia.ts";

describe("toAuthenticatedMediaUrl", () => {
    it("rewrites the download endpoint", () => {
        expect(toAuthenticatedMediaUrl("https://hs.example/_matrix/media/v3/download/hs.example/abc")).toBe(
            "https://hs.example/_matrix/client/v1/media/download/hs.example/abc",
        );
    });

    it("rewrites the thumbnail endpoint and keeps its query parameters", () => {
        expect(
            toAuthenticatedMediaUrl(
                "https://hs.example/_matrix/media/v3/thumbnail/hs.example/abc?width=30&method=crop",
            ),
        ).toBe("https://hs.example/_matrix/client/v1/media/thumbnail/hs.example/abc?width=30&method=crop");
    });

    it("leaves other media endpoints alone", () => {
        // The worker deliberately does not intercept these, so neither do we.
        const preview = "https://hs.example/_matrix/media/v3/preview_url?url=https%3A%2F%2Fexample.com";
        expect(toAuthenticatedMediaUrl(preview)).toBe(preview);

        const unstable = "https://hs.example/_matrix/media/unstable/download/hs.example/abc";
        expect(toAuthenticatedMediaUrl(unstable)).toBe(unstable);
    });

    it("does not rewrite a path that merely contains the media prefix", () => {
        const nested = "https://hs.example/proxy/_matrix/media/v3/download/hs.example/abc";
        expect(toAuthenticatedMediaUrl(nested)).toBe(nested);
    });
});

describe("fetchAuthenticatedMedia", () => {
    const LEGACY = "https://matrix.org/_matrix/media/v3/download/matrix.org/1234";
    const AUTHED = "https://matrix.org/_matrix/client/v1/media/download/matrix.org/1234";

    const setController = (controller: object | null): void => {
        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            configurable: true,
            value: { controller } as unknown as ServiceWorkerContainer,
        });
    };

    const authedMediaClient = (): ReturnType<typeof stubClient> => {
        const cli = stubClient();
        vi.mocked(cli.getAccessToken).mockReturnValue("token_abc");
        vi.mocked(cli.isVersionSupported).mockResolvedValue(true);
        return cli;
    };

    afterEach(() => {
        Reflect.deleteProperty(globalThis.navigator, "serviceWorker");
        vi.restoreAllMocks();
        fetchMock.mockReset();
    });

    it("rewrites and authenticates when no worker controls the page", async () => {
        const cli = authedMediaClient();
        setController(null);
        fetchMock.get(AUTHED, { status: 200, body: "data" });

        await fetchAuthenticatedMedia(LEGACY, cli);

        const call = fetchMock.callHistory.lastCall(AUTHED);
        expect(call).toBeDefined();
        expect(new Headers(call!.options.headers).get("Authorization")).toBe("Bearer token_abc");
    });

    it("passes the request init through, so an abort signal still aborts", async () => {
        const cli = authedMediaClient();
        setController(null);
        fetchMock.get(AUTHED, { status: 200, body: "data" });
        const controller = new AbortController();

        await fetchAuthenticatedMedia(LEGACY, cli, {
            signal: controller.signal,
            headers: { "X-Test": "kept" },
        });

        const call = fetchMock.callHistory.lastCall(AUTHED);
        expect(call!.options.signal).toBe(controller.signal);
        // Our header is added to the caller's rather than replacing them.
        expect(new Headers(call!.options.headers).get("X-Test")).toBe("kept");
    });

    it("leaves the request unchanged when the support check cannot be answered", async () => {
        const cli = authedMediaClient();
        // The SDK requests /versions authenticated, so an expired token makes this reject
        // rather than report no support. It must not take the media request with it.
        vi.mocked(cli.isVersionSupported).mockRejectedValue(new Error("M_UNKNOWN_TOKEN"));
        setController(null);
        fetchMock.get(LEGACY, { status: 200, body: "data" });

        await expect(fetchAuthenticatedMedia(LEGACY, cli)).resolves.toBeDefined();

        const call = fetchMock.callHistory.lastCall(LEGACY);
        expect(call).toBeDefined();
        expect(new Headers(call!.options.headers).get("Authorization")).toBeNull();
    });

    it("does not check server support while a worker is in control", async () => {
        const cli = authedMediaClient();
        setController({});
        fetchMock.get(LEGACY, { status: 200, body: "data" });

        await fetchAuthenticatedMedia(LEGACY, cli);

        expect(fetchMock.callHistory.lastCall(LEGACY)).toBeDefined();
        expect(cli.isVersionSupported).not.toHaveBeenCalled();
    });
});
