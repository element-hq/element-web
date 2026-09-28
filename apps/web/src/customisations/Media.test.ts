/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fetchMock from "@fetch-mock/vitest";
import { stubClient } from "test-utils";

import { mediaFromMxc } from "./Media";

describe("Media", () => {
    const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

    beforeEach(() => {
        fetchMock.mockClear();
        fetchMock.removeRoutes();
        delete (window as any).electron;
    });

    afterEach(() => {
        fetchMock.mockClear();
        fetchMock.removeRoutes();
        delete (window as any).electron;
        if (originalServiceWorker) {
            Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
        } else {
            delete (navigator as any).serviceWorker;
        }
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

    describe("downloadSource() authentication fallback", () => {
        const legacyUrl = "https://matrix.org/_matrix/media/v3/download/matrix.org/1234";
        const authedUrl = "https://matrix.org/_matrix/client/v1/media/download/matrix.org/1234";

        it("delegates to legacy URL without Authorization header when service worker controls page", async () => {
            Object.defineProperty(navigator, "serviceWorker", {
                value: { controller: {} as ServiceWorker },
                configurable: true,
            });

            const cli = stubClient();
            vi.mocked(cli.getAccessToken).mockReturnValue("test_token");
            vi.mocked(cli.isVersionSupported).mockResolvedValue(true);
            // eslint-disable-next-line no-restricted-properties
            vi.mocked(cli.mxcUrlToHttp).mockImplementation((mxc, w, h, m, dir, red, authed) =>
                authed ? authedUrl : legacyUrl,
            );

            fetchMock.get(legacyUrl, { status: 200, body: "file_data" });

            const media = mediaFromMxc("mxc://matrix.org/1234");
            const response = await media.downloadSource();

            expect(response.status).toBe(200);
            expect(fetchMock).toHaveFetched(legacyUrl);
            expect(fetchMock.callHistory.lastCall()?.options?.headers).toBeUndefined();
        });

        it("falls back to authenticated URL and Authorization header when SW is uncontrolled and server supports v1.11", async () => {
            Object.defineProperty(navigator, "serviceWorker", {
                value: { controller: null },
                configurable: true,
            });

            const cli = stubClient();
            vi.mocked(cli.getAccessToken).mockReturnValue("test_token");
            vi.mocked(cli.isVersionSupported).mockResolvedValue(true);
            // eslint-disable-next-line no-restricted-properties
            vi.mocked(cli.mxcUrlToHttp).mockImplementation((mxc, w, h, m, dir, red, authed) =>
                authed ? authedUrl : legacyUrl,
            );

            fetchMock.get(authedUrl, { status: 200, body: "file_data" });

            const media = mediaFromMxc("mxc://matrix.org/1234");
            const response = await media.downloadSource();

            expect(response.status).toBe(200);
            expect(fetchMock).toHaveFetched(authedUrl, {
                headers: {
                    Authorization: "Bearer test_token",
                },
            });
        });

        it("falls back to legacy URL without Authorization header when server does not support v1.11", async () => {
            Object.defineProperty(navigator, "serviceWorker", {
                value: { controller: null },
                configurable: true,
            });

            const cli = stubClient();
            vi.mocked(cli.getAccessToken).mockReturnValue("test_token");
            vi.mocked(cli.isVersionSupported).mockResolvedValue(false);
            // eslint-disable-next-line no-restricted-properties
            vi.mocked(cli.mxcUrlToHttp).mockImplementation((mxc, w, h, m, dir, red, authed) =>
                authed ? authedUrl : legacyUrl,
            );

            fetchMock.get(legacyUrl, { status: 200, body: "file_data" });

            const media = mediaFromMxc("mxc://matrix.org/1234");
            const response = await media.downloadSource();

            expect(response.status).toBe(200);
            expect(fetchMock).toHaveFetched(legacyUrl);
            expect(fetchMock.callHistory.lastCall()?.options?.headers).toBeUndefined();
        });

        it("falls back to legacy URL without Authorization header when access token is missing", async () => {
            Object.defineProperty(navigator, "serviceWorker", {
                value: { controller: null },
                configurable: true,
            });

            const cli = stubClient();
            vi.mocked(cli.getAccessToken).mockReturnValue(null);
            vi.mocked(cli.isVersionSupported).mockResolvedValue(true);
            // eslint-disable-next-line no-restricted-properties
            vi.mocked(cli.mxcUrlToHttp).mockImplementation((mxc, w, h, m, dir, red, authed) =>
                authed ? authedUrl : legacyUrl,
            );

            fetchMock.get(legacyUrl, { status: 200, body: "file_data" });

            const media = mediaFromMxc("mxc://matrix.org/1234");
            const response = await media.downloadSource();

            expect(response.status).toBe(200);
            expect(fetchMock).toHaveFetched(legacyUrl);
            expect(fetchMock.callHistory.lastCall()?.options?.headers).toBeUndefined();
            expect(cli.isVersionSupported).not.toHaveBeenCalled();
        });

        it("does not apply web fallback when in Electron", async () => {
            Object.defineProperty(navigator, "serviceWorker", {
                value: { controller: null },
                configurable: true,
            });
            (window as any).electron = {};

            const cli = stubClient();
            vi.mocked(cli.getAccessToken).mockReturnValue("test_token");
            vi.mocked(cli.isVersionSupported).mockResolvedValue(true);
            // eslint-disable-next-line no-restricted-properties
            vi.mocked(cli.mxcUrlToHttp).mockImplementation((mxc, w, h, m, dir, red, authed) =>
                authed ? authedUrl : legacyUrl,
            );

            fetchMock.get(legacyUrl, { status: 200, body: "file_data" });

            const media = mediaFromMxc("mxc://matrix.org/1234");
            const response = await media.downloadSource();

            expect(response.status).toBe(200);
            expect(fetchMock).toHaveFetched(legacyUrl);
            expect(fetchMock.callHistory.lastCall()?.options?.headers).toBeUndefined();
        });
    });
});
