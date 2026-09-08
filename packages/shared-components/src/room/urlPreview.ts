/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { UnstableBundledUrlPreviewSingle } from "@element-hq/element-web-module-api";

export interface UrlPreview {
    /**
     * The URL for the preview.
     */
    link: string;
    /**
     * Should the link have a tooltip. Should be `true` if the platform does not provide a tooltip.
     */
    showTooltipOnLink: boolean;
    /**
     * The title of the page being previewed.
     */
    title: string;
    /**
     * The site name to be displayed alongside the title.
     */
    siteName: string;
    /**
     * The og:url value of the page, could be different from link
     */
    ogUrl?: string;
    /**
     * The HTTP URI of the the sites icon.
     */
    siteIcon?: string;
    /**
     * Description of the site. May contain links.
     */
    description?: string;
    /**
     * Preview image to display.
     */
    image?: {
        /**
         * The HTTP URI of the the thumbnail.
         */
        imageThumb: string;
        /**
         * The HTTP URI of the full image.
         */
        imageFull: string;
        /**
         * The mxc:// URI of the full image.
         */
        mxcImageFull: string;
        /**
         * The type/subtype of the image format
         */
        imageType?: string;
        /**
         * File size in bytes.
         */
        fileSize?: number;
        /**
         * The width of the thumbnail.
         */
        width?: number;
        /**
         * The height of the thumbnail.
         */
        height?: number;
        /**
         * Alt text for the image
         */
        alt?: string;

        /**
         * Is the media playable.
         */
        playable: boolean;
    };

    /**
     * Author of the content, if specified.
     */
    author?: string;

    /**
     * The URL bundle (MSC4095) that the UrlPreview is constructed from (if it is constructed from a URL preview)
     */
    srcBundle?: UnstableBundledUrlPreviewSingle;
}

/** Snapshot data for the URL previews attached to an event. */
export interface UrlPreviewGroupViewSnapshot {
    /** URL previews to render. */
    previews: Array<UrlPreview>;
    /** Total number of previews available before limiting. */
    totalPreviewCount: number;
    /** Whether the preview list is currently limited. */
    previewsLimited: boolean;
    /** Whether more previews exist than are currently rendered. */
    overPreviewLimit: boolean;
}

/** User actions accepted by the URL preview group. */
export interface UrlPreviewGroupViewActions {
    /** Invoked when the preview limit toggle is clicked. */
    onTogglePreviewLimit: () => void;
    /** Invoked when the hide-preview action is clicked. */
    onHideClick: () => Promise<void>;
    /** Invoked when a preview image is clicked. */
    onImageClick: (preview: UrlPreview) => void;
}
