/*
Copyright 2015, 2016 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';

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
 * consume in the timeline, when performing scroll offset calcuations
 * (e.g. scroll locking)
 */
export function thumbHeight(fullWidth, fullHeight, thumbWidth, thumbHeight) {
    if (!fullWidth || !fullHeight) {
        // Cannot calculate thumbnail height for image: missing w/h in metadata. We can't even
        // log this because it's spammy
        return undefined;
    }
    if (fullWidth < thumbWidth && fullHeight < thumbHeight) {
        // no scaling needs to be applied
        return fullHeight;
    }
    const widthMulti = thumbWidth / fullWidth;
    const heightMulti = thumbHeight / fullHeight;
    if (widthMulti < heightMulti) {
        // width is the dominant dimension so scaling will be fixed on that
        return Math.floor(widthMulti * fullHeight);
    } else {
        // height is the dominant dimension so scaling will be fixed on that
        return Math.floor(heightMulti * fullHeight);
    }
}

