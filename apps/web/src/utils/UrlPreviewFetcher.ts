/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import { type IPreviewUrlResponse, type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { decode } from "html-entities";

import type { UrlPreview } from "@element-hq/web-shared-components";
import { mediaFromMxc } from "../customisations/Media";
import { thumbHeight } from "../ImageUtils";

const logger = rootLogger.getChild("UrlPreviewFetcher");

export const PREVIEW_WIDTH_PX = 478;
export const PREVIEW_HEIGHT_PX = 200;
export const MIN_PREVIEW_PX = 96;
export const MIN_IMAGE_SIZE_BYTES = 8192;

/**
 * Handles fetching and parsing URL previews.
 * Maintains a cache of previously fetched previews; call `clearCache` when
 * media visibility changes so images are re-fetched with the correct visibility.
 */
export class UrlPreviewFetcher {
    private readonly cache = new Map<string, UrlPreview>();

    public constructor(
        private readonly client: MatrixClient,
        private readonly previewRequestTs: number,
        private readonly showTooltips: boolean,
    ) {}

    public clearCache(): void {
        this.cache.clear();
    }

    /**
     * Parse a numeric value from OpenGraph. The OpenGraph spec defines all values as strings
     * although Synapse may return these values as numbers. To be compatible, test strings
     * and numbers.
     * @param value The numeric value
     * @returns A number if the value parsed correctly, or undefined otherwise.
     */
    private static getNumberFromOpenGraph(value: number | string | undefined): number | undefined {
        if (typeof value === "number") {
            return value;
        } else if (typeof value === "string" && value) {
            const i = Number.parseInt(value, 10);
            if (!Number.isNaN(i)) return i;
        }
        return undefined;
    }

    /**
     * Calculate the best possible title from an opengraph response.
     * @param response The opengraph response
     * @param link The link being used to preview.
     * @returns The title value.
     */
    private static getBaseMetadataFromResponse(
        response: IPreviewUrlResponse,
        link: string,
    ): Pick<UrlPreview, "title" | "description" | "siteName"> {
        let title =
            typeof response["og:title"] === "string" && response["og:title"].trim()
                ? response["og:title"].trim()
                : undefined;
        let description =
            typeof response["og:description"] === "string" && response["og:description"].trim()
                ? response["og:description"].trim()
                : undefined;
        const siteName =
            typeof response["og:site_name"] === "string" && response["og:site_name"].trim()
                ? response["og:site_name"].trim()
                : new URL(link).hostname;

        if (!title && description) {
            title = description;
            description = undefined;
        } else if (!title && siteName) {
            title = siteName;
        } else if (!title) {
            title = link;
        }

        if (description && description.toLowerCase() === siteName.toLowerCase()) {
            description = undefined;
        }

        return { title, description: description && decode(description), siteName };
    }

    /**
     * Calculate the best possible author from an opengraph response.
     * @param response The opengraph response
     * @returns The author value, or undefined if no valid author could be found.
     */
    private static getAuthorFromResponse(response: IPreviewUrlResponse): UrlPreview["author"] {
        let calculatedAuthor: string | undefined;
        if (response["og:type"] === "article") {
            if (typeof response["article:author"] === "string" && response["article:author"]) {
                calculatedAuthor = response["article:author"];
            }
        }
        if (typeof response["profile:username"] === "string" && response["profile:username"]) {
            calculatedAuthor = response["profile:username"];
        }
        if (calculatedAuthor && URL.canParse(calculatedAuthor)) {
            return undefined;
        }
        return calculatedAuthor;
    }

    /**
     * Calculate whether the provided image from the preview response is an full size preview or
     * a site icon.
     * @returns `true` if the image should be used as a preview, otherwise `false`
     */
    private static isImagePreview(width?: number, height?: number, bytes?: number): boolean {
        if (width && width < MIN_PREVIEW_PX) return false;
        if (height && height < MIN_PREVIEW_PX) return false;
        if (bytes && bytes < MIN_IMAGE_SIZE_BYTES) return false;
        return true;
    }

    /**
     * Fetch a preview for a single URL, returning a cached result if available.
     * @param link The URL to preview.
     * @param loadMedia Whether to include the preview image. Pass false when media is hidden.
     */
    public async fetchPreview(link: string, loadMedia: boolean): Promise<UrlPreview | null> {
        const cached = this.cache.get(link);
        if (cached) return cached;

        let response: IPreviewUrlResponse;
        try {
            response = await this.client.getUrlPreview(link, this.previewRequestTs);
        } catch (error) {
            if (error instanceof MatrixError && error.httpStatus === 404) {
                logger.debug("Failed to get URL preview: ", error);
            } else {
                logger.error("Failed to get URL preview: ", error);
            }
            return null;
        }

        const { title, description, siteName } = UrlPreviewFetcher.getBaseMetadataFromResponse(response, link);
        const author = UrlPreviewFetcher.getAuthorFromResponse(response);
        const hasImage = response["og:image"] && typeof response["og:image"] === "string";

        if (title === link && !hasImage) {
            return null;
        }

        let image: UrlPreview["image"];
        let siteIcon: string | undefined;

        if (typeof response["og:image"] === "string" && loadMedia) {
            const media = mediaFromMxc(response["og:image"], this.client);
            const declaredHeight = UrlPreviewFetcher.getNumberFromOpenGraph(response["og:image:height"]);
            const declaredWidth = UrlPreviewFetcher.getNumberFromOpenGraph(response["og:image:width"]);
            const imageSize = UrlPreviewFetcher.getNumberFromOpenGraph(response["matrix:image:size"]);
            const alt = typeof response["og:image:alt"] === "string" ? response["og:image:alt"] : undefined;

            if (UrlPreviewFetcher.isImagePreview(declaredWidth, declaredHeight, imageSize)) {
                const width = Math.min(declaredWidth ?? PREVIEW_WIDTH_PX, PREVIEW_WIDTH_PX);
                const height =
                    thumbHeight(width, declaredHeight, PREVIEW_WIDTH_PX, PREVIEW_WIDTH_PX) ?? PREVIEW_WIDTH_PX;
                const thumb = media.getThumbnailOfSourceHttp(PREVIEW_WIDTH_PX, PREVIEW_HEIGHT_PX, "scale");
                const playable = !!response["og:video"] || !!response["og:video:type"] || !!response["og:audio"];
                if (thumb) {
                    image = {
                        imageThumb: thumb,
                        imageFull: media.srcHttp ?? thumb,
                        width,
                        height,
                        fileSize: UrlPreviewFetcher.getNumberFromOpenGraph(response["matrix:image:size"]),
                        alt,
                        playable,
                    };
                }
            } else if (media.srcHttp) {
                siteIcon = media.srcHttp;
            }
        }

        const result = {
            link,
            title,
            author,
            description,
            siteName,
            siteIcon,
            showTooltipOnLink: !!(link !== title && this.showTooltips),
            image,
        } satisfies UrlPreview;
        this.cache.set(link, result);
        return result;
    }
}
