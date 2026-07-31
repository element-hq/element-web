/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// For Large the image gets drawn as big as possible.
// constraint by: timeline width, manual height overrides, SIZE_LARGE.h
const SIZE_LARGE = { w: 800, h: 600 };
// Spark's normal timeline media frame is 230px wide, with a 460px vertical
// cap. Keeping the same bound for animated GIF/WebP and static image events
// prevents graphics from jumping to Element's much larger 324px default.
// Timeline width and any explicit height override still take precedence.
const SIZE_NORMAL = { w: 230, h: 460 };

type Dimensions = { w?: number; h?: number };

export enum ImageSize {
    Normal = "normal",
    Large = "large",
}

/**
 * @param {ImageSize} size The user's image size preference
 * @param {Dimensions} contentSize The natural dimensions of the content
 * @param {number} maxHeight Overrides the default height limit
 * @returns {Dimensions} The suggested maximum dimensions for the image
 */
export function suggestedSize(size: ImageSize, contentSize: Dimensions, maxHeight?: number): Required<Dimensions> {
    const aspectRatio = contentSize.w! / contentSize.h!;
    const maxSize = size === ImageSize.Large ? SIZE_LARGE : SIZE_NORMAL;
    if (!contentSize.w || !contentSize.h) {
        return maxSize;
    }

    const constrainedSize = {
        w: Math.min(maxSize.w, contentSize.w),
        h: maxHeight ? Math.min(maxSize.h, contentSize.h, maxHeight) : Math.min(maxSize.h, contentSize.h),
    };

    if (constrainedSize.h * aspectRatio < constrainedSize.w) {
        // Height dictates width
        return { w: Math.floor(constrainedSize.h * aspectRatio), h: constrainedSize.h };
    } else {
        // Width dictates height
        return { w: constrainedSize.w, h: Math.floor(constrainedSize.w / aspectRatio) };
    }
}
