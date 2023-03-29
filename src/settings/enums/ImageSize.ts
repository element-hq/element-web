/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// For Large the image gets drawn as big as possible.
// constraint by: timeline width, manual height overrides, SIZE_LARGE.h
const SIZE_LARGE = { w: 800, h: 600 };
// For Normal the image gets drawn to never exceed SIZE_NORMAL.w, SIZE_NORMAL.h
// constraint by: timeline width, manual height overrides
const SIZE_NORMAL_LANDSCAPE = { w: 324, h: 324 }; // for w > h
const SIZE_NORMAL_PORTRAIT = { w: Math.ceil(324 * (9 / 16)), h: 324 }; // for h > w

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
    const portrait = aspectRatio < 1;

    const maxSize = size === ImageSize.Large ? SIZE_LARGE : portrait ? SIZE_NORMAL_PORTRAIT : SIZE_NORMAL_LANDSCAPE;
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
