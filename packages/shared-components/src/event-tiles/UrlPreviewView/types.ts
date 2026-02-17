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
     *
     */
    title: string;
    siteName?: string;
    description?: string;
    image?: {
        imageThumb: string;
        imageFull: string;
        fileSize?: number;
        width?: number;
        height?: number;
    };
}
