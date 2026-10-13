/*
Copyright 2024 New Vector Ltd.
Copyright 2015, 2016 , 2020 Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Returns the size that an image of dimensions (fullWidth, fullHeight) will occupy
 * if resized to fit inside a bounding box of size (thumbWidth, thumbHeight), keeping
 * its aspect ratio. An image which already fits is not scaled up.
 *
 * Returns null if either dimension of the image is unknown.
 */
export function thumbSize(
    fullWidth: number,
    fullHeight: number,
    thumbWidth: number,
    thumbHeight: number,
): { width: number; height: number };
export function thumbSize(
    fullWidth: number | undefined,
    fullHeight: number | undefined,
    thumbWidth: number,
    thumbHeight: number,
): { width: number; height: number } | null;
export function thumbSize(
    fullWidth: number | undefined,
    fullHeight: number | undefined,
    thumbWidth: number,
    thumbHeight: number,
): { width: number; height: number } | null {
    if (!fullWidth || !fullHeight) {
        // Cannot calculate the size for an image missing w/h in its metadata. We can't even
        // log this because it's spammy
        return null;
    }
    const scale = Math.min(1, thumbWidth / fullWidth, thumbHeight / fullHeight);
    return { width: Math.floor(fullWidth * scale), height: Math.floor(fullHeight * scale) };
}

/**
 * Returns the actual height that an image of dimensions (fullWidth, fullHeight)
 * will occupy if resized to fit inside a thumbnail bounding box of size
 * (thumbWidth, thumbHeight).
 *
 * If the aspect ratio of the source image is taller than the aspect ratio of
 * the thumbnail bounding box, then we return the thumbHeight parameter unchanged.
 * Otherwise we return the thumbHeight parameter scaled down appropriately to
 * reflect the actual height the scaled thumbnail occupies.
 *
 * This is very useful for calculating how much height a thumbnail will actually
 * consume in the timeline, when performing scroll offset calculations
 * (e.g. scroll locking)
 */
export function thumbHeight(fullWidth: number, fullHeight: number, thumbWidth: number, thumbHeight: number): number;
export function thumbHeight(
    fullWidth: number | undefined,
    fullHeight: number | undefined,
    thumbWidth: number,
    thumbHeight: number,
): null;
export function thumbHeight(
    fullWidth: number | undefined,
    fullHeight: number | undefined,
    thumbWidth: number,
    thumbHeight: number,
): number | null {
    return thumbSize(fullWidth, fullHeight, thumbWidth, thumbHeight)?.height ?? null;
}
