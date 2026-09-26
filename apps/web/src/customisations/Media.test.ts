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

import { mediaFromMxc } from "./Media";

describe("Media", () => {
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
        const AUTHED = "https://matrix.org/_matrix/client/v1/media/download/matrix.org/1234";
        const LEGACY = "https://matrix.org/_matrix/media/v3/download/matrix.org/1234";

        /** Mock mxcUrlToHttp so the two endpoints are distinguishable by URL. */
        const mockUrls = (cli: ReturnType<typeof stubClient>): void => {
            // eslint-disable-next-line no-restricted-properties
            vi.mocked(cli.mxcUrlToHttp).mockImplementation((mxc, _w, _h, _m, _direct, _redirect, useAuthentication) =>
                useAuthentication
                    ? `https://matrix.org/_matrix/client/v1/media/download/${mxc.slice(6)}`
                    : `https://matrix.org/_matrix/media/v3/download/${mxc.slice(6)}`,
            );
        };

        // happy-dom's navigator has no serviceWorker at all, so this defines the
        // property rather than spying on it, and afterEach removes it again.
        const setController = (controller: object | null): void => {
            Object.defineProperty(globalThis.navigator, "serviceWorker", {
                configurable: true,
                value: { controller } as unknown as ServiceWorkerContainer,
            });
        };

        /** The Authorization header the one request to `url` carried, if any. */
        const authHeaderFor = (url: string): string | null => {
            const call = fetchMock.callHistory.lastCall(url);
            expect(call, `no request was made to ${url}`).toBeDefined();
            return new Headers(call!.options.headers).get("Authorization");
        };

        afterEach(() => {
            Reflect.deleteProperty(globalThis.navigator, "serviceWorker");
            vi.restoreAllMocks();
            fetchMock.mockReset();
        });

        it("uses the unauthenticated URL and sends no header when the service worker controls the page", async () => {
            const cli = stubClient();
            mockUrls(cli);
            setController({});

            fetchMock.get(LEGACY, { status: 200, body: "data" });

            await mediaFromMxc("mxc://matrix.org/1234").downloadSource();

            // The worker rewrites and authenticates this; sending our own header
            // here would duplicate what it does.
            expect(authHeaderFor(LEGACY)).toBeNull();
        });

        it("falls back to the authenticated endpoint with a bearer token when no service worker controls the page", async () => {
            const cli = stubClient();
            mockUrls(cli);
            vi.mocked(cli.getAccessToken).mockReturnValue("token_abc");
            setController(null);

            fetchMock.get(AUTHED, { status: 200, body: "data" });

            await mediaFromMxc("mxc://matrix.org/1234").downloadSource();

            // Without this the request goes to the retired /_matrix/media/v3
            // endpoint unauthenticated, which a homeserver with authenticated
            // media enabled answers 404.
            expect(authHeaderFor(AUTHED)).toBe("Bearer token_abc");
        });

        it("does not send an empty bearer header when uncontrolled and no access token is available", async () => {
            const cli = stubClient();
            mockUrls(cli);
            vi.mocked(cli.getAccessToken).mockReturnValue(null);
            setController(null);

            fetchMock.get(AUTHED, { status: 200, body: "data" });

            await mediaFromMxc("mxc://matrix.org/1234").downloadSource();

            expect(authHeaderFor(AUTHED)).toBeNull();
        });
    });
});
