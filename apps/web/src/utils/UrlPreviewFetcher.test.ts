/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { vi, describe, it, expect, beforeAll, afterAll, type Mock } from "vitest";

import type { IPreviewUrlResponse, MatrixClient } from "matrix-js-sdk/src/matrix";
import { UrlPreviewFetcher } from "./UrlPreviewFetcher";

const IMAGE_MXC = "mxc://example.org/abc";
const BASIC_PREVIEW_OGDATA = {
    "og:title": "This is an example!",
    "og:description": "This is a description",
    "og:type": "document",
    "og:url": "https://example.org",
    "og:site_name": "Example.org",
};

function getFetcher(): {
    fetcher: UrlPreviewFetcher;
    client: { getUrlPreview: Mock; mxcUrlToHttp: Mock };
} {
    const client = {
        getUrlPreview: vi.fn(),
        mxcUrlToHttp: vi.fn(),
    } as unknown as MatrixClient;
    return {
        fetcher: new UrlPreviewFetcher(client, 0, false),
        client: client as unknown as { getUrlPreview: Mock; mxcUrlToHttp: Mock },
    };
}

describe("UrlPreviewFetcher", () => {
    let originalDevicePixelRatio: Window["devicePixelRatio"];
    beforeAll(() => {
        originalDevicePixelRatio = window.devicePixelRatio;
        window.devicePixelRatio = 1;
    });
    afterAll(() => {
        window.devicePixelRatio = originalDevicePixelRatio;
    });
    it("should return null when the fetch fails", async () => {
        const { fetcher, client } = getFetcher();
        client.getUrlPreview.mockRejectedValue(new Error("Forced test failure"));
        expect(await fetcher.fetchPreview("https://example.org", true)).toBeNull();
    });

    it("should return null when title equals the URL and there is no image", async () => {
        const { fetcher, client } = getFetcher();
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "https://example.org",
            "og:type": "document",
            "og:url": "https://example.org",
        });
        expect(await fetcher.fetchPreview("https://example.org", true)).toBeNull();
    });

    it("should cache results and not re-fetch for the same URL", async () => {
        const { fetcher, client } = getFetcher();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        await fetcher.fetchPreview("https://example.org", true);
        await fetcher.fetchPreview("https://example.org", true);
        expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
    });

    it("should re-fetch after clearCache is called", async () => {
        const { fetcher, client } = getFetcher();
        client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
        await fetcher.fetchPreview("https://example.org", true);
        fetcher.clearCache();
        await fetcher.fetchPreview("https://example.org", true);
        expect(client.getUrlPreview).toHaveBeenCalledTimes(2);
    });

    it("should not process media when loadMedia is false", async () => {
        const { fetcher, client } = getFetcher();
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "This is an example!",
            "og:type": "document",
            "og:url": "https://example.org",
            "og:image": IMAGE_MXC,
            "og:image:height": 128,
            "og:image:width": 128,
            "matrix:image:size": 10000,
        });
        const preview = await fetcher.fetchPreview("https://example.org", false);
        expect(preview?.image).toBeUndefined();
        // eslint-disable-next-line no-restricted-properties
        expect(client.mxcUrlToHttp).not.toHaveBeenCalled();
    });

    it("should preview a URL with media", async () => {
        const { fetcher, client } = getFetcher();
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "This is an example!",
            "og:type": "document",
            "og:url": "https://example.org",
            "og:image": IMAGE_MXC,
            "og:image:height": 128,
            "og:image:width": 128,
            "matrix:image:size": 10000,
        });
        // eslint-disable-next-line no-restricted-properties
        client.mxcUrlToHttp.mockImplementation((url, width) => {
            expect(url).toEqual(IMAGE_MXC);
            if (width) return "https://example.org/image/thumb";
            return "https://example.org/image/src";
        });
        const preview = await fetcher.fetchPreview("https://example.org", true);
        expect(preview).toMatchSnapshot();
    });

    it.each<Partial<IPreviewUrlResponse>>([
        { "matrix:image:size": 8191 },
        { "og:image:width": 95 },
        { "og:image:height": 95 },
    ])("should use a site icon for small images %s", async (extraResp) => {
        const { fetcher, client } = getFetcher();
        client.getUrlPreview.mockResolvedValueOnce({
            "og:title": "This is an example!",
            "og:type": "document",
            "og:url": "https://example.org",
            "og:image": IMAGE_MXC,
            "og:image:height": 128,
            "og:image:width": 128,
            "matrix:image:size": 8193,
            ...extraResp,
        });
        // eslint-disable-next-line no-restricted-properties
        client.mxcUrlToHttp.mockImplementation((url) => {
            expect(url).toEqual(IMAGE_MXC);
            return "https://example.org/image/src";
        });
        const preview = await fetcher.fetchPreview("https://example.org", true);
        expect(preview?.siteIcon).toBeTruthy();
        expect(preview?.image).toBeUndefined();
    });

    it.each<string>(["og:video", "og:video:type", "og:audio"])("detects playable links via %s", async (property) => {
        const { fetcher, client } = getFetcher();
        // eslint-disable-next-line no-restricted-properties
        client.mxcUrlToHttp.mockImplementation((url, width) => {
            if (width) return "https://example.org/image/thumb";
            return "https://example.org/image/src";
        });
        client.getUrlPreview.mockResolvedValueOnce({
            ...BASIC_PREVIEW_OGDATA,
            "og:image": IMAGE_MXC,
            "og:image:height": 128,
            "og:image:width": 128,
            "matrix:image:size": 10000,
            [property]: "anything",
        });
        const preview = await fetcher.fetchPreview("https://example.org", true);
        expect(preview?.image?.playable).toBe(true);
    });

    describe("calculates author", () => {
        it("should use the profile:username if provided", async () => {
            const { fetcher, client } = getFetcher();
            client.getUrlPreview.mockResolvedValueOnce({ ...BASIC_PREVIEW_OGDATA, "profile:username": "my username" });
            const preview = await fetcher.fetchPreview("https://example.org", true);
            expect(preview?.author).toEqual("my username");
        });

        it("should use author if the og:type is an article", async () => {
            const { fetcher, client } = getFetcher();
            client.getUrlPreview.mockResolvedValueOnce({
                ...BASIC_PREVIEW_OGDATA,
                "og:type": "article",
                "article:author": "my name",
            });
            const preview = await fetcher.fetchPreview("https://example.org", true);
            expect(preview?.author).toEqual("my name");
        });

        it("should NOT use author if the author is a URL", async () => {
            const { fetcher, client } = getFetcher();
            client.getUrlPreview.mockResolvedValueOnce({
                ...BASIC_PREVIEW_OGDATA,
                "og:type": "article",
                "article:author": "https://junk.example.org/foo",
            });
            const preview = await fetcher.fetchPreview("https://example.org", true);
            expect(preview?.author).toBeUndefined();
        });
    });

    // og:url and og:type are not surfaced in the preview.
    const baseOg = {
        "og:url": "https://example.org",
        "og:type": "document",
    };

    it.each<IPreviewUrlResponse>([
        { ...baseOg, "og:title": "Basic title" },
        { ...baseOg, "og:site_name": "Site name", "og:title": "" },
        { ...baseOg, "og:description": "A description", "og:title": "" },
        { ...baseOg, "og:title": "Cool blog", "og:site_name": "Cool site" },
        {
            ...baseOg,
            "og:title": "Media test",
            // API *may* return a string, so check we parse correctly.
            "og:image:height": "500" as unknown as number,
            "og:image:width": 500,
            "matrix:image:size": 10000,
            "og:image": IMAGE_MXC,
        },
    ])("handles different kinds of opengraph responses %s", async (og) => {
        const { fetcher, client } = getFetcher();
        // eslint-disable-next-line no-restricted-properties
        client.mxcUrlToHttp.mockImplementation((url, width) => {
            if (width) return "https://example.org/image/thumb";
            return "https://example.org/image/src";
        });
        client.getUrlPreview.mockResolvedValueOnce(og);
        const preview = await fetcher.fetchPreview("https://example.org", true);
        expect(preview).toMatchSnapshot();
    });
});
