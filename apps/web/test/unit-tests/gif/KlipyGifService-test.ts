/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fetchMock from "@fetch-mock/jest";

import { KlipyGifService, pickBestFormat, type KlipyGifResult } from "../../../src/gif/KlipyGifService";
import SdkConfig from "../../../src/SdkConfig";

describe("KlipyGifService", () => {
    const mockApiKey = "test-klipy-api-key";
    const klipyBase = "https://api.klipy.com/v2";

    beforeEach(() => {
        SdkConfig.put({
            gif: {
                api_key: mockApiKey,
            },
        } as any);
    });

    describe("isAvailable", () => {
        it("should return true when API key is configured", () => {
            const service = KlipyGifService.sharedInstance();
            expect(service.isAvailable()).toBe(true);
        });

        it("should return false when API key is not configured", () => {
            SdkConfig.put({} as any);
            const service = KlipyGifService.sharedInstance();
            expect(service.isAvailable()).toBe(false);
        });
    });

    describe("search", () => {
        it("should call Klipy search endpoint with correct params", async () => {
            const mockResponse = {
                results: [
                    {
                        id: "123",
                        title: "funny cat",
                        content_description: "A funny cat",
                        media_formats: {
                            gif: { url: "https://klipy.com/gif.gif", dims: [480, 360], duration: 2, size: 100000 },
                            tinygif: {
                                url: "https://klipy.com/tinygif.gif",
                                dims: [220, 165],
                                duration: 2,
                                size: 50000,
                            },
                            mediumgif: {
                                url: "https://klipy.com/mediumgif.gif",
                                dims: [320, 240],
                                duration: 2,
                                size: 75000,
                            },
                            nanogif: {
                                url: "https://klipy.com/nanogif.gif",
                                dims: [90, 68],
                                duration: 2,
                                size: 20000,
                            },
                            webp: {
                                url: "https://klipy.com/preview.webp",
                                dims: [480, 360],
                                duration: 2,
                                size: 60000,
                            },
                        },
                        created: 1234567890,
                        url: "https://klipy.com/view/funny-cat-123",
                    },
                ],
                next: "next-cursor",
            };

            fetchMock.getOnce(`begin:${klipyBase}/search`, mockResponse, { name: "klipy-search" });

            const service = KlipyGifService.sharedInstance();
            const result = await service.search("funny cat", 10);

            expect(fetchMock).toHaveFetched(`begin:${klipyBase}/search`);

            // Verify exact URL parameters from the call
            const calls = fetchMock.callHistory.calls();
            const searchCall = calls.find((c) => c.url.includes("/v2/search"));
            expect(searchCall).toBeDefined();
            const calledUrl = new URL(searchCall!.url);
            expect(calledUrl.searchParams.get("key")).toBe(mockApiKey);
            expect(calledUrl.searchParams.get("q")).toBe("funny cat");
            expect(calledUrl.searchParams.get("limit")).toBe("10");
            expect(calledUrl.searchParams.get("client_key")).toBe("element-web");

            expect(result.results).toHaveLength(1);
            expect(result.results[0].id).toBe("123");
            expect(result.next).toBe("next-cursor");
        });

        it("should include pagination cursor when provided", async () => {
            fetchMock.getOnce(`begin:${klipyBase}/search`, { results: [], next: "" }, { name: "klipy-search-paged" });

            const service = KlipyGifService.sharedInstance();
            await service.search("test", 20, "cursor-123");

            const calls = fetchMock.callHistory.calls();
            const searchCall = calls.find((c) => c.url.includes("/v2/search"));
            expect(searchCall).toBeDefined();
            const calledUrl = new URL(searchCall!.url);
            expect(calledUrl.searchParams.get("pos")).toBe("cursor-123");
        });

        it("should throw on API error", async () => {
            fetchMock.getOnce(
                `begin:${klipyBase}/search`,
                { status: 403, body: "Forbidden" },
                {
                    name: "klipy-search-error",
                },
            );

            const service = KlipyGifService.sharedInstance();
            await expect(service.search("test")).rejects.toThrow("Klipy API error: 403 Forbidden");
        });
    });

    describe("featured", () => {
        it("should call Klipy featured endpoint", async () => {
            fetchMock.getOnce(
                `begin:${klipyBase}/featured`,
                { results: [], next: "" },
                {
                    name: "klipy-featured",
                },
            );

            const service = KlipyGifService.sharedInstance();
            await service.featured(15);

            expect(fetchMock).toHaveFetched(`begin:${klipyBase}/featured`);

            const calls = fetchMock.callHistory.calls();
            const featuredCall = calls.find((c) => c.url.includes("/v2/featured"));
            expect(featuredCall).toBeDefined();
            const calledUrl = new URL(featuredCall!.url);
            expect(calledUrl.searchParams.get("key")).toBe(mockApiKey);
            expect(calledUrl.searchParams.get("limit")).toBe("15");
        });
    });

    describe("categories", () => {
        it("should call Klipy categories endpoint", async () => {
            fetchMock.getOnce(
                `begin:${klipyBase}/categories`,
                {
                    tags: [{ searchterm: "funny", path: "/funny", image: "https://klipy.com/img.gif", name: "#funny" }],
                },
                { name: "klipy-categories" },
            );

            const service = KlipyGifService.sharedInstance();
            const result = await service.categories();

            expect(fetchMock).toHaveFetched(`begin:${klipyBase}/categories`);
            expect(result.tags).toHaveLength(1);
            expect(result.tags[0].searchterm).toBe("funny");
        });
    });

    describe("without API key", () => {
        it("should throw when calling search without API key", async () => {
            SdkConfig.put({} as any);
            const service = KlipyGifService.sharedInstance();
            await expect(service.search("test")).rejects.toThrow("Klipy API key is not configured");
        });
    });

    describe("pickBestFormat", () => {
        function makeGif(overrides: Partial<Record<string, any>> = {}): KlipyGifResult {
            return {
                id: "test-1",
                title: "Test GIF",
                content_description: "A test GIF",
                media_formats: {
                    gif: { url: "https://klipy.com/full.gif", dims: [480, 360], duration: 2, size: 500_000 },
                    tinygif: { url: "https://klipy.com/tiny.gif", dims: [220, 165], duration: 2, size: 50_000 },
                    mediumgif: { url: "https://klipy.com/medium.gif", dims: [320, 240], duration: 2, size: 200_000 },
                    nanogif: { url: "https://klipy.com/nano.gif", dims: [90, 68], duration: 2, size: 15_000 },
                    ...overrides,
                },
                created: 1234567890,
                url: "https://klipy.com/view/test-1",
            };
        }

        it("should use gif format for full-res when under 3MB", () => {
            const gif = makeGif();
            const result = pickBestFormat(gif);
            expect(result.full.url).toBe("https://klipy.com/full.gif");
            expect(result.full.mimeType).toBe("image/gif");
            expect(result.full.width).toBe(480);
            expect(result.full.height).toBe(360);
        });

        it("should fall back to mediumgif when gif exceeds 3MB", () => {
            const gif = makeGif({
                gif: { url: "https://klipy.com/full.gif", dims: [480, 360], duration: 2, size: 4_000_000 },
            });
            const result = pickBestFormat(gif);
            expect(result.full.url).toBe("https://klipy.com/medium.gif");
            expect(result.full.mimeType).toBe("image/gif");
        });

        it("should prefer webp for full-res when smaller than gif", () => {
            const gif = makeGif({
                webp: { url: "https://klipy.com/full.webp", dims: [480, 360], duration: 2, size: 300_000 },
            });
            const result = pickBestFormat(gif);
            expect(result.full.url).toBe("https://klipy.com/full.webp");
            expect(result.full.mimeType).toBe("image/webp");
        });

        it("should not prefer webp for full-res when larger than gif", () => {
            const gif = makeGif({
                webp: { url: "https://klipy.com/full.webp", dims: [480, 360], duration: 2, size: 600_000 },
            });
            const result = pickBestFormat(gif);
            expect(result.full.url).toBe("https://klipy.com/full.gif");
            expect(result.full.mimeType).toBe("image/gif");
        });

        it("should prefer webp over mediumgif when gif exceeds 3MB and webp is smaller", () => {
            const gif = makeGif({
                gif: { url: "https://klipy.com/full.gif", dims: [480, 360], duration: 2, size: 4_000_000 },
                webp: { url: "https://klipy.com/full.webp", dims: [480, 360], duration: 2, size: 100_000 },
            });
            const result = pickBestFormat(gif);
            expect(result.full.url).toBe("https://klipy.com/full.webp");
            expect(result.full.mimeType).toBe("image/webp");
        });

        it("should use tinygif for preview by default", () => {
            const gif = makeGif();
            const result = pickBestFormat(gif);
            expect(result.preview.url).toBe("https://klipy.com/tiny.gif");
            expect(result.preview.mimeType).toBe("image/gif");
        });

        it("should fall back to nanogif for preview when tinygif is missing", () => {
            const gif = makeGif();
            // Remove tinygif to test fallback (cast to allow deleting required field)
            delete (gif.media_formats as any).tinygif;
            const result = pickBestFormat(gif);
            expect(result.preview.url).toBe("https://klipy.com/nano.gif");
            expect(result.preview.mimeType).toBe("image/gif");
        });

        it("should fall back to mediumgif for preview when tinygif and nanogif are missing", () => {
            const gif = makeGif();
            delete (gif.media_formats as any).tinygif;
            delete (gif.media_formats as any).nanogif;
            const result = pickBestFormat(gif);
            expect(result.preview.url).toBe("https://klipy.com/medium.gif");
            expect(result.preview.mimeType).toBe("image/gif");
        });

        it("should prefer webp for preview when smaller than tinygif", () => {
            const gif = makeGif({
                webp: { url: "https://klipy.com/preview.webp", dims: [220, 165], duration: 2, size: 30_000 },
            });
            const result = pickBestFormat(gif);
            expect(result.preview.url).toBe("https://klipy.com/preview.webp");
            expect(result.preview.mimeType).toBe("image/webp");
        });

        it("should not prefer webp for preview when larger than tinygif", () => {
            const gif = makeGif({
                webp: { url: "https://klipy.com/preview.webp", dims: [220, 165], duration: 2, size: 80_000 },
            });
            const result = pickBestFormat(gif);
            expect(result.preview.url).toBe("https://klipy.com/tiny.gif");
            expect(result.preview.mimeType).toBe("image/gif");
        });
    });
});
