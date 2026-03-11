/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

export interface UrlPreviewViewSnapshotPreview {
    /**
     * The URL for the preview.
     */
    link: string;
    /**
     * Should the link have a tooltip. Should be `true` if the platform does not provide a tooltip.
     */
    showTooltipOnLink?: boolean;
    /**
     * The title of the page being previewed.
     */
    title: string;
    /**
     * The site name to be displayed alongside the title.
     */
    siteName?: string;
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
         * File size in bytes.
         */
        fileSize?: number;
        /**
         * The width of the thumbnail. Must not exceed 100px.
         */
        width?: number;
        /**
         * The height of the thumbnail. Must not exceed 100px.
         */
        height?: number;
    };
}
