/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import SdkConfig from "../SdkConfig";

const KLIPY_API_BASE = "https://api.klipy.com/v2";

/** Media format details returned by the Klipy API. */
export interface KlipyMediaFormat {
    url: string;
    dims: [number, number]; // [width, height]
    duration: number;
    size: number;
}

/** A single GIF result from the Klipy API. */
export interface KlipyGifResult {
    id: string;
    title: string;
    content_description: string;
    media_formats: {
        gif: KlipyMediaFormat;
        tinygif: KlipyMediaFormat;
        mediumgif: KlipyMediaFormat;
        nanogif: KlipyMediaFormat;
        webp?: KlipyMediaFormat;
        mp4?: KlipyMediaFormat;
        tinymp4?: KlipyMediaFormat;
    };
    created: number;
    url: string;
}

/** Response from the Klipy search and featured endpoints. */
export interface KlipySearchResponse {
    results: KlipyGifResult[];
    next: string;
}

/** Response from the Klipy categories endpoint. */
export interface KlipyCategory {
    searchterm: string;
    path: string;
    image: string;
    name: string;
}

export interface KlipyCategoriesResponse {
    tags: KlipyCategory[];
}

/** Describes the best format choice for a GIF, including URL, MIME type, and dimensions. */
export interface GifFormatChoice {
    url: string;
    mimeType: string;
    width: number;
    height: number;
    size: number;
}

/** The result of picking the best full-res and preview formats for a GIF. */
export interface BestGifFormats {
    full: GifFormatChoice;
    preview: GifFormatChoice;
}

const MAX_FULL_RES_SIZE = 3 * 1024 * 1024; // 3MB cap for full-res GIFs

/**
 * Converts a KlipyMediaFormat into a GifFormatChoice with the given MIME type.
 */
function toChoice(format: KlipyMediaFormat, mimeType: string): GifFormatChoice {
    return {
        url: format.url,
        mimeType,
        width: format.dims[0],
        height: format.dims[1],
        size: format.size,
    };
}

/**
 * Picks the best full-resolution and preview formats for a GIF result,
 * optimising for size (3 MB cap, WebP preference when smaller) following
 * the same strategy used by the Commet Matrix client.
 *
 * Full-res selection:
 *  1. Start with `gif`.
 *  2. If >3 MB and `mediumgif` exists, fall back to `mediumgif`.
 *  3. If `webp` exists and is smaller than the current pick, prefer it.
 *
 * Preview selection:
 *  1. `tinygif` → `nanogif` → `mediumgif` fallback chain.
 *  2. If `webp` exists and is smaller than the current pick, prefer it.
 */
export function pickBestFormat(gif: KlipyGifResult): BestGifFormats {
    const formats = gif.media_formats;

    // --- Full resolution ---
    let full = toChoice(formats.gif, "image/gif");

    // If full-res exceeds 3 MB, try mediumgif
    if (full.size > MAX_FULL_RES_SIZE && formats.mediumgif) {
        full = toChoice(formats.mediumgif, "image/gif");
    }

    // Prefer webp if it exists and is smaller
    if (formats.webp && formats.webp.size < full.size) {
        full = toChoice(formats.webp, "image/webp");
    }

    // --- Preview ---
    let preview: GifFormatChoice;
    if (formats.tinygif) {
        preview = toChoice(formats.tinygif, "image/gif");
    } else if (formats.nanogif) {
        preview = toChoice(formats.nanogif, "image/gif");
    } else {
        preview = toChoice(formats.mediumgif, "image/gif");
    }

    // Prefer webp if it exists and is smaller
    if (formats.webp && formats.webp.size < preview.size) {
        preview = toChoice(formats.webp, "image/webp");
    }

    return { full, preview };
}

/**
 * Returns the Klipy API key from the deployment config, or undefined if not configured.
 */
function getApiKey(): string | undefined {
    const gifConfig = SdkConfig.get("gif");
    return gifConfig?.api_key;
}

/**
 * Builds a URL for the Klipy API with common query parameters.
 */
function buildUrl(endpoint: string, params: Record<string, string>): string {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("Klipy API key is not configured");
    }

    const url = new URL(`${KLIPY_API_BASE}/${endpoint}`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("client_key", "element-web");
    // Request webp and gif formats for size optimization
    url.searchParams.set("media_filter", "gif,tinygif,mediumgif,nanogif,webp");
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return url.toString();
}

/**
 * Service for interacting with the Klipy GIF API.
 *
 * Provides methods for searching GIFs, fetching trending GIFs, and fetching categories.
 * Requires a Klipy API key to be configured in the deployment config under `gif.api_key`.
 */
export class KlipyGifService {
    private static instance: KlipyGifService | null = null;

    public static sharedInstance(): KlipyGifService {
        if (!KlipyGifService.instance) {
            KlipyGifService.instance = new KlipyGifService();
        }
        return KlipyGifService.instance;
    }

    /**
     * Returns true if the Klipy GIF service is available (i.e. an API key is configured).
     */
    public isAvailable(): boolean {
        return !!getApiKey();
    }

    /**
     * Search for GIFs matching the given query.
     *
     * @param query - The search term
     * @param limit - Maximum number of results to return (default 20)
     * @param next - Pagination cursor from a previous response
     * @returns Search results and pagination cursor
     */
    public async search(query: string, limit = 20, next?: string): Promise<KlipySearchResponse> {
        const params: Record<string, string> = {
            q: query,
            limit: String(limit),
        };
        if (next) {
            params.pos = next;
        }

        const url = buildUrl("search", params);
        return this.fetchApi<KlipySearchResponse>(url);
    }

    /**
     * Fetch currently trending/featured GIFs.
     *
     * @param limit - Maximum number of results to return (default 20)
     * @param next - Pagination cursor from a previous response
     * @returns Trending GIF results and pagination cursor
     */
    public async featured(limit = 20, next?: string): Promise<KlipySearchResponse> {
        const params: Record<string, string> = {
            limit: String(limit),
        };
        if (next) {
            params.pos = next;
        }

        const url = buildUrl("featured", params);
        return this.fetchApi<KlipySearchResponse>(url);
    }

    /**
     * Fetch GIF categories for browsing.
     *
     * @returns List of GIF categories with preview images
     */
    public async categories(): Promise<KlipyCategoriesResponse> {
        const url = buildUrl("categories", {});
        return this.fetchApi<KlipyCategoriesResponse>(url);
    }

    private async fetchApi<T>(url: string): Promise<T> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Klipy API error: ${response.status} ${response.statusText}`);
            }
            return (await response.json()) as T;
        } catch (error) {
            logger.error("Klipy GIF API request failed:", error);
            throw error;
        }
    }
}
