/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { stubClient } from "test-utils";

import { mediaFromContent, mediaFromMxc } from "./Media";

describe("Media", () => {
    const AUTHED = "https://matrix.org/_matrix/client/v1/media/download/matrix.org/1234";
    const LEGACY = "https://matrix.org/_matrix/media/v3/download/matrix.org/1234";
    const THUMB_AUTHED = "https://matrix.org/_matrix/client/v1/media/download/matrix.org/thumb";
    const THUMB_LEGACY = "https://matrix.org/_matrix/media/v3/download/matrix.org/thumb";

    /** The getters yield the unauthenticated URL, as they deliberately do in production. */
    const mockUrls = (cli: ReturnType<typeof stubClient>): void => {
        // eslint-disable-next-line no-restricted-properties
        vi.mocked(cli.mxcUrlToHttp).mockImplementation(
            (mxc) => `https://matrix.org/_matrix/media/v3/download/${mxc.slice(6)}`,
        );
    };

    /** A homeserver with authenticated media enabled, and a token to authenticate with. */
    const mockAuthedMedia = (cli: ReturnType<typeof stubClient>, token: string | null = "token_abc"): void => {
        vi.mocked(cli.getAccessToken).mockReturnValue(token);
        vi.mocked(cli.isVersionSupported).mockResolvedValue(true);
    };

    // happy-dom's navigator has no serviceWorker at all, so this defines the property
    // rather than spying on it, and afterEach removes it again.
    const setController = (controller: object | null): void => {
        Object.defineProperty(globalThis.navigator, "serviceWorker", {
            configurable: true,
            value: { controller } as unknown as ServiceWorkerContainer,
        });
    };

    /** The Authorization header the last request to `url` carried, if any. */
    const authHeaderFor = (url: string): string | null => {
        const call = fetchMock.callHistory.lastCall(url);
        expect(call, `no request was made to ${url}`).toBeDefined();
        return new Headers(call!.options.headers).get("Authorization");
    };

    /** Media whose thumbnail is a second, distinguishable MXC. */
    const mediaWithThumbnail = (): ReturnType<typeof mediaFromContent> =>
        mediaFromContent({
            url: "mxc://matrix.org/1234",
            info: { thumbnail_url: "mxc://matrix.org/thumb" },
        });

    afterEach(() => {
        Reflect.deleteProperty(globalThis.navigator, "serviceWorker");
        vi.restoreAllMocks();
        fetchMock.mockReset();
    });

    it("should not download error if server returns one", async () => {
        const cli = stubClient();
        // eslint-disable-next-line no-restricted-properties
        vi.mocked(cli.mxcUrlToHttp).mockImplementation(
            (mxc) => `https://matrix.org/_matrix/media/r0/download/${mxc.slice(6)}`,
        );

        fetchMock.get("https://matrix.org/_matrix/media/r0/download/matrix.org/1234", {
            status: 404,
            body: { errcode: "M_NOT_FOUND", error: "Not found" },
        });

        const media = mediaFromMxc("mxc://matrix.org/1234");
        await expect(media.downloadSource()).rejects.toThrow("Not found");
    });

    describe("downloadSource", () => {
        it("leaves the request alone when the service worker controls the page", async () => {
            const cli = stubClient();
            mockUrls(cli);
            mockAuthedMedia(cli);
            setController({});

            fetchMock.get(LEGACY, { status: 200, body: "data" });

            await mediaFromMxc("mxc://matrix.org/1234").downloadSource();

            // The worker rewrites and authenticates this; doing it ourselves as well would
            // duplicate its work and bypass the caching it does.
            expect(authHeaderFor(LEGACY)).toBeNull();
        });

        it("authenticates the request itself when no service worker controls the page", async () => {
            const cli = stubClient();
            mockUrls(cli);
            mockAuthedMedia(cli);
            setController(null);

            fetchMock.get(AUTHED, { status: 200, body: "data" });

            await mediaFromMxc("mxc://matrix.org/1234").downloadSource();

            // Without this the request goes to the retired /_matrix/media/v3 endpoint
            // unauthenticated, which a homeserver with authenticated media answers 404.
            expect(authHeaderFor(AUTHED)).toBe("Bearer token_abc");
        });

        it("leaves the request alone when uncontrolled and no access token is available", async () => {
            const cli = stubClient();
            mockUrls(cli);
            mockAuthedMedia(cli, null);
            setController(null);

            fetchMock.get(LEGACY, { status: 200, body: "data" });

            await mediaFromMxc("mxc://matrix.org/1234").downloadSource();

            expect(authHeaderFor(LEGACY)).toBeNull();
        });

        it("leaves the request alone when the homeserver does not support authenticated media", async () => {
            const cli = stubClient();
            mockUrls(cli);
            vi.mocked(cli.getAccessToken).mockReturnValue("token_abc");
            vi.mocked(cli.isVersionSupported).mockResolvedValue(false);
            setController(null);

            fetchMock.get(LEGACY, { status: 200, body: "data" });

            await mediaFromMxc("mxc://matrix.org/1234").downloadSource();

            // A server still serving the legacy endpoints has no authenticated one to ask,
            // so rewriting would turn a working download into a 404.
            expect(authHeaderFor(LEGACY)).toBeNull();
        });
    });

    describe("downloadThumbnail", () => {
        it("leaves the request alone when the service worker controls the page", async () => {
            const cli = stubClient();
            mockUrls(cli);
            mockAuthedMedia(cli);
            setController({});

            fetchMock.get(THUMB_LEGACY, { status: 200, body: "data" });

            await mediaWithThumbnail().downloadThumbnail();

            expect(authHeaderFor(THUMB_LEGACY)).toBeNull();
        });

        it("authenticates the request itself when no service worker controls the page", async () => {
            const cli = stubClient();
            mockUrls(cli);
            mockAuthedMedia(cli);
            setController(null);

            fetchMock.get(THUMB_AUTHED, { status: 200, body: "data" });

            await mediaWithThumbnail().downloadThumbnail();

            // Thumbnails are what MediaEventHelper.fetchThumbnail fetches, and they failed
            // the same way downloads did: a 404 from the retired endpoint.
            expect(authHeaderFor(THUMB_AUTHED)).toBe("Bearer token_abc");
        });

        it("resolves to null without making a request when no thumbnail is recorded", async () => {
            const cli = stubClient();
            mockUrls(cli);
            setController(null);

            await expect(mediaFromMxc("mxc://matrix.org/1234").downloadThumbnail()).resolves.toBeNull();

            expect(fetchMock.callHistory.calls()).toHaveLength(0);
        });

        it("does not throw on a non-ok response, unlike downloadSource", async () => {
            const cli = stubClient();
            mockUrls(cli);
            mockAuthedMedia(cli);
            setController(null);

            fetchMock.get(THUMB_AUTHED, { status: 404, body: { errcode: "M_NOT_FOUND", error: "Not found" } });

            // The caller treats an unusable thumbnail as absent rather than surfacing an
            // error, which is the behaviour it had before this went through Media.
            const res = await mediaWithThumbnail().downloadThumbnail();
            expect(res?.status).toBe(404);
        });
    });
});
