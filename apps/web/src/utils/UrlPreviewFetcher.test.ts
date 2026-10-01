/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { vi, describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, type Mock } from "vitest";

import type { IPreviewUrlResponse, MatrixClient } from "matrix-js-sdk/src/matrix";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type EncryptedFile } from "matrix-js-sdk/src/types";

import type { UrlPreview } from "shared-types";
import { UrlPreviewFetcher } from "./UrlPreviewFetcher";
import { type UnstableBundledUrlPreviewSingle } from "../../@types/url-preview";
import { type UrlPreviewApi } from "../modules/UrlPreviewApi";
import { decryptFile } from "./DecryptFile";

vi.mock("./DecryptFile", () => ({ decryptFile: vi.fn() }));

const IMAGE_MXC = "mxc://example.org/abc";
const BASIC_PREVIEW_OGDATA = {
    "og:title": "This is an example!",
    "og:description": "This is a description",
    "og:type": "document",
    "og:url": "https://example.org",
    "og:site_name": "Example.org",
};

function getFetcher(showTooltips = false): {
    fetcher: UrlPreviewFetcher;
    client: { getUrlPreview: Mock; mxcUrlToHttp: Mock };
    moduleApi: { getPreview: Mock };
} {
    const client = {
        getUrlPreview: vi.fn(),
        mxcUrlToHttp: vi.fn(),
    } as unknown as MatrixClient;
    // By default no module handles the URL, so we fall through to the bundle/server logic.
    const moduleApi = { getPreview: vi.fn().mockResolvedValue(null) };
    return {
        fetcher: new UrlPreviewFetcher(client, 0, showTooltips, moduleApi as unknown as UrlPreviewApi),
        client: client as unknown as { getUrlPreview: Mock; mxcUrlToHttp: Mock },
        moduleApi,
    };
}

/**
 * Build the message event a bundled preview is attached to. Only the body is used
 * by the fetcher itself, the rest is handed to the module API.
 */
function mkMessageEvent(body: string): MatrixEvent {
    return new MatrixEvent({
        type: "m.room.message",
        content: { msgtype: "m.text", body },
        event_id: "$event-id",
        room_id: "!room:example.org",
        sender: "@alice:example.org",
        origin_server_ts: 0,
    });
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

    describe("previewFromBundle", () => {
        const BASIC_BUNDLE: UnstableBundledUrlPreviewSingle = {
            "matched_url": "https://example.org/page",
            "og:title": "Bundled title",
            "og:description": "Bundled description",
            "og:url": "https://example.org/canonical",
        };

        const BASIC_BODY = "Check out https://example.org/page";
        const BASIC_EVENT = mkMessageEvent(BASIC_BODY);

        const IMAGE_BUNDLE: UnstableBundledUrlPreviewSingle = {
            ...BASIC_BUNDLE,
            "og:image": IMAGE_MXC,
            "og:image:type": "image/png",
            "og:image:width": 500,
            "og:image:height": 400,
            "matrix:image:size": 10000,
        };

        /** The UrlPreview.image that IMAGE_BUNDLE resolves to once the media is mocked. */
        const IMAGE_PREVIEW: NonNullable<UrlPreview["image"]> = {
            imageThumb: "https://example.org/image/thumb",
            imageFull: "https://example.org/image/src",
            imageType: "image/png",
            mxcImageFull: IMAGE_MXC,
            width: 500,
            height: 400,
            playable: false,
        };

        function mockMedia(client: { mxcUrlToHttp: Mock }): void {
            // eslint-disable-next-line no-restricted-properties
            client.mxcUrlToHttp.mockImplementation((url, width) => {
                expect(url).toEqual(IMAGE_MXC);
                if (width) return "https://example.org/image/thumb";
                return "https://example.org/image/src";
            });
        }

        it("should map basic bundle fields without an image", async () => {
            const { fetcher, client } = getFetcher();
            const preview = await fetcher.previewFromBundle(BASIC_BUNDLE, BASIC_EVENT);
            expect(preview).toEqual({
                link: "https://example.org/page",
                title: "Bundled title",
                siteName: "example.org",
                showTooltipOnLink: false,
                description: "Bundled description",
                ogUrl: "https://example.org/canonical",
            });
            // eslint-disable-next-line no-restricted-properties
            expect(client.mxcUrlToHttp).not.toHaveBeenCalled();
        });

        it("should fallback to the matched_url when there is no title", async () => {
            const { fetcher } = getFetcher();
            const preview = await fetcher.previewFromBundle(
                { "matched_url": "https://example.org/page", "og:url": "https://example.org/page" },
                BASIC_EVENT,
            );
            expect(preview!.title).toEqual("https://example.org/page");
            expect(preview!.showTooltipOnLink).toBe(false);
        });

        it("should set showTooltipOnLink when tooltips are enabled and title differs from the URL", async () => {
            const { fetcher } = getFetcher(true);
            const preview = await fetcher.previewFromBundle(BASIC_BUNDLE, BASIC_EVENT);
            expect(preview!.showTooltipOnLink).toBe(true);
        });

        // Unlike fetchPreview, the tooltip flag is computed against the raw og:title rather than
        // the resolved title, so a missing og:title still shows a tooltip even though the displayed
        // title falls back to the matched_url.
        it("should set showTooltipOnLink when tooltips are enabled and og:title is absent", async () => {
            const { fetcher } = getFetcher(true);
            const preview = await fetcher.previewFromBundle(
                { "matched_url": "https://example.org/page", "og:url": "https://example.org/page" },
                BASIC_EVENT,
            );
            expect(preview!.showTooltipOnLink).toBe(true);
        });

        it("should not set showTooltipOnLink when tooltips are enabled but og:title equals the URL", async () => {
            const { fetcher } = getFetcher(true);
            const preview = await fetcher.previewFromBundle(
                {
                    "matched_url": "https://example.org/page",
                    "og:title": "https://example.org/page",
                },
                BASIC_EVENT,
            );
            expect(preview!.showTooltipOnLink).toBe(false);
        });

        it("should include the image when all image fields are present", async () => {
            const { fetcher, client } = getFetcher();
            mockMedia(client);
            const preview = await fetcher.previewFromBundle(IMAGE_BUNDLE, BASIC_EVENT);
            expect(preview!.image).toEqual(IMAGE_PREVIEW);
        });

        it("should omit the image when there is no og:image", async () => {
            const { fetcher, client } = getFetcher();
            mockMedia(client);
            const preview = await fetcher.previewFromBundle({ ...IMAGE_BUNDLE, "og:image": undefined }, BASIC_EVENT);
            expect(preview!.image).toBeUndefined();
        });

        // The type and dimensions are optional on UrlPreview.image, and the tiles only need
        // imageThumb to render, so a bundle that omits them still gets a preview image. This
        // matches fetchPreview, which shows an image even when the server omits these fields.
        it.each<[keyof UnstableBundledUrlPreviewSingle, Partial<NonNullable<UrlPreview["image"]>>]>([
            ["og:image:type", { imageType: undefined }],
            ["og:image:width", { width: undefined }],
            ["og:image:height", { height: undefined }],
        ])("should still include the image when %s is absent", async (field, expected) => {
            const { fetcher, client } = getFetcher();
            mockMedia(client);
            const preview = await fetcher.previewFromBundle({ ...IMAGE_BUNDLE, [field]: undefined }, BASIC_EVENT);
            expect(preview!.image).toEqual({ ...IMAGE_PREVIEW, ...expected });
        });

        // The sender controls the bundle, so a dimension that is not a number is dropped rather
        // than passed through as a string. The image itself is still shown.
        it("should ignore non-numeric image dimensions", async () => {
            const { fetcher, client } = getFetcher();
            mockMedia(client);
            const preview = await fetcher.previewFromBundle(
                { ...IMAGE_BUNDLE, "og:image:width": {} as unknown as number },
                BASIC_EVENT,
            );
            expect(preview!.image).toEqual({ ...IMAGE_PREVIEW, width: undefined });
        });

        // A numeric string is still usable, so it is parsed rather than dropped.
        it("should parse image dimensions given as numeric strings", async () => {
            const { fetcher, client } = getFetcher();
            mockMedia(client);
            const preview = await fetcher.previewFromBundle(
                { ...IMAGE_BUNDLE, "og:image:width": "500" as unknown as number },
                BASIC_EVENT,
            );
            expect(preview!.image).toEqual(IMAGE_PREVIEW);
        });

        it("should omit the image when the media mxc URL is malformed", async () => {
            const { fetcher, client } = getFetcher();
            // A malformed/unresolvable mxc yields no HTTP URL.
            // eslint-disable-next-line no-restricted-properties
            client.mxcUrlToHttp.mockReturnValue(null);
            const preview = await fetcher.previewFromBundle(IMAGE_BUNDLE, BASIC_EVENT);
            expect(preview!.image).toBeUndefined();
            // The rest of the preview is still returned.
            expect(preview?.title).toEqual("Bundled title");
        });

        it("should compute the siteName from the matched_url hostname", async () => {
            const { fetcher } = getFetcher();
            const preview = await fetcher.previewFromBundle(
                {
                    ...BASIC_BUNDLE,
                    matched_url: "https://sub.example.com:8443/some/path?q=1",
                },
                mkMessageEvent("Check out https://sub.example.com:8443/some/path?q=1"),
            );
            expect(preview?.siteName).toEqual("sub.example.com");
        });

        it.each([
            "",
            null,
            true,
            123,
            "javascript:execute_me",
            "data:evil",
            "mailto:foo@bar",
            "x-http://not-real",
            "htttps://still-not-real",
        ])("should reject '%s'", async (url) => {
            const { fetcher } = getFetcher();
            const preview = await fetcher.previewFromBundle(
                {
                    ...BASIC_BUNDLE,
                    "og:url": url as string,
                    "matched_url": url as string,
                },
                mkMessageEvent("Check out " + url),
            );
            expect(preview).toBeNull();
        });

        it("should reject urls not present in the event body", async () => {
            const { fetcher } = getFetcher();
            const preview = await fetcher.previewFromBundle(BASIC_BUNDLE, mkMessageEvent("No urls in here"));
            expect(preview).toBeNull();
        });

        it("should pass the whole event to the module API", async () => {
            const { fetcher, moduleApi } = getFetcher();
            await fetcher.previewFromBundle(BASIC_BUNDLE, BASIC_EVENT);
            expect(moduleApi.getPreview).toHaveBeenCalledWith("https://example.org/page", BASIC_EVENT);
        });

        it("should use the preview from the module API in preference to the bundle", async () => {
            const { fetcher, client, moduleApi } = getFetcher();
            const modulePreview = {
                link: "https://example.org/page",
                title: "Module title",
                siteName: "module.example.org",
                showTooltipOnLink: false,
            };
            moduleApi.getPreview.mockResolvedValue(modulePreview);
            const preview = await fetcher.previewFromBundle(IMAGE_BUNDLE, BASIC_EVENT);
            expect(preview).toBe(modulePreview);
            expect(client.getUrlPreview).not.toHaveBeenCalled();
            // eslint-disable-next-line no-restricted-properties
            expect(client.mxcUrlToHttp).not.toHaveBeenCalled();
        });

        it("should fetch bundle from server if only matched_url is present", async () => {
            const { fetcher, client } = getFetcher();
            client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
            const preview = await fetcher.previewFromBundle({ matched_url: BASIC_BUNDLE.matched_url }, BASIC_EVENT);
            expect(client.getUrlPreview).toHaveBeenCalledTimes(1);
            expect(preview).not.toBeNull();
        });

        it("should not fetch bundle from server when server fallback is disallowed", async () => {
            const { fetcher, client } = getFetcher();
            client.getUrlPreview.mockResolvedValue(BASIC_PREVIEW_OGDATA);
            const preview = await fetcher.previewFromBundle(
                { matched_url: BASIC_BUNDLE.matched_url },
                BASIC_EVENT,
                false,
                false,
            );
            expect(client.getUrlPreview).not.toHaveBeenCalled();
            expect(preview).toBeNull();
        });

        // In an encrypted room the preview image is sent as an attachment rather than as a plain
        // mxc:// URL, so it has to be downloaded and decrypted client-side before it can be shown.
        describe("with an encrypted image", () => {
            const ENCRYPTED_FILE = {
                url: "mxc://example.org/encrypted",
                iv: "iv",
                hashes: { sha256: "sha256" },
                v: "v2",
                key: { alg: "A256CTR", ext: true, k: "k", key_ops: ["encrypt", "decrypt"], kty: "oct" },
            } as EncryptedFile;

            const ENCRYPTED_BUNDLE: UnstableBundledUrlPreviewSingle = {
                ...BASIC_BUNDLE,
                "og:image:type": "image/png",
                "og:image:width": 500,
                "og:image:height": 400,
                "beeper:image:encryption": ENCRYPTED_FILE,
            };

            let createObjectUrl: Mock;
            let revokeObjectUrl: Mock;

            beforeEach(() => {
                let next = 0;
                createObjectUrl = vi.fn(() => `blob:decrypted-${next++}`);
                revokeObjectUrl = vi.fn();
                vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectUrl);
                vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectUrl);
                vi.mocked(decryptFile).mockResolvedValue(new Blob(["decrypted"]));
            });

            afterEach(() => {
                vi.mocked(decryptFile).mockReset();
                vi.mocked(URL.createObjectURL).mockRestore();
                vi.mocked(URL.revokeObjectURL).mockRestore();
            });

            it("should decrypt the image and use its object URL for both sizes", async () => {
                const { fetcher, client } = getFetcher();
                const preview = await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, true);

                expect(decryptFile).toHaveBeenCalledWith(ENCRYPTED_FILE);
                expect(preview!.image).toEqual({
                    // There is no server-side thumbnail for an attachment, so the full image is
                    // used for both.
                    imageThumb: "blob:decrypted-0",
                    imageFull: "blob:decrypted-0",
                    imageType: "image/png",
                    mxcImageFull: ENCRYPTED_FILE.url,
                    width: 500,
                    height: 400,
                    playable: false,
                });
                // The encrypted attachment is never resolved as a plain mxc:// URL.
                // eslint-disable-next-line no-restricted-properties
                expect(client.mxcUrlToHttp).not.toHaveBeenCalled();
            });

            // Decrypting downloads the media eagerly, which is exactly what hiding media is meant
            // to avoid, so the rest of the preview is returned without an image.
            it("should not decrypt the image when media is hidden", async () => {
                const { fetcher } = getFetcher();
                const preview = await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, false);

                expect(decryptFile).not.toHaveBeenCalled();
                expect(preview!.image).toBeUndefined();
                expect(preview!.title).toEqual("Bundled title");
            });

            it("should omit the image when the decryption fails", async () => {
                const { fetcher } = getFetcher();
                vi.mocked(decryptFile).mockRejectedValue(new Error("Forced test failure"));

                const preview = await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, true);

                expect(preview!.image).toBeUndefined();
                // The textual part of the preview is still usable.
                expect(preview!.title).toEqual("Bundled title");
                expect(createObjectUrl).not.toHaveBeenCalled();
            });

            // The same preview is re-rendered on every timeline update, so decrypting once per
            // render would download the image over and over.
            it("should reuse the object URL when the same image is previewed again", async () => {
                const { fetcher } = getFetcher();
                const first = await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, true);
                const second = await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, true);

                expect(decryptFile).toHaveBeenCalledTimes(1);
                expect(createObjectUrl).toHaveBeenCalledTimes(1);
                expect(second!.image!.imageFull).toEqual(first!.image!.imageFull);
            });

            it("should prefer the encrypted image over a plain og:image", async () => {
                const { fetcher, client } = getFetcher();
                mockMedia(client);
                const preview = await fetcher.previewFromBundle(
                    { ...ENCRYPTED_BUNDLE, "og:image": IMAGE_MXC },
                    BASIC_EVENT,
                    true,
                );

                expect(preview!.image!.imageFull).toEqual("blob:decrypted-0");
                expect(preview!.image!.mxcImageFull).toEqual(ENCRYPTED_FILE.url);
                // eslint-disable-next-line no-restricted-properties
                expect(client.mxcUrlToHttp).not.toHaveBeenCalled();
            });

            it("should still include the image when the bundle omits its dimensions", async () => {
                const { fetcher } = getFetcher();
                const preview = await fetcher.previewFromBundle(
                    {
                        ...ENCRYPTED_BUNDLE,
                        "og:image:type": undefined,
                        "og:image:width": undefined,
                        "og:image:height": undefined,
                    },
                    BASIC_EVENT,
                    true,
                );

                expect(preview!.image).toEqual({
                    imageThumb: "blob:decrypted-0",
                    imageFull: "blob:decrypted-0",
                    imageType: undefined,
                    mxcImageFull: ENCRYPTED_FILE.url,
                    width: undefined,
                    height: undefined,
                    playable: false,
                });
            });

            // Object URLs pin the decrypted blob in memory until they are revoked.
            it("should revoke the object URLs it created when disposed", async () => {
                const { fetcher } = getFetcher();
                await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, true);

                fetcher.dispose();

                expect(revokeObjectUrl).toHaveBeenCalledWith("blob:decrypted-0");
            });

            it("should revoke the object URLs and decrypt again after clearCache", async () => {
                const { fetcher } = getFetcher();
                await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, true);

                fetcher.clearCache();
                expect(revokeObjectUrl).toHaveBeenCalledWith("blob:decrypted-0");

                const preview = await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, true);
                expect(decryptFile).toHaveBeenCalledTimes(2);
                expect(preview!.image!.imageFull).toEqual("blob:decrypted-1");
            });

            // Revoking twice would hand a stale URL to revokeObjectURL.
            it("should not revoke the same object URL twice", async () => {
                const { fetcher } = getFetcher();
                await fetcher.previewFromBundle(ENCRYPTED_BUNDLE, BASIC_EVENT, true);

                fetcher.revokeObjectUrls();
                fetcher.revokeObjectUrls();

                expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
            });
        });
    });
});
