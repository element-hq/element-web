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
// constraint by: timeline width, manual heigh overrides, SIZE_LARGE.h
const SIZE_LARGE = { w: 800, h: 600 };

// For Normal the image gets drawn to never exceed SIZE_NORMAL.w, SIZE_NORMAL.h
// constraint by: timeline width, manual heigh overrides
const SIZE_NORMAL_LANDSCAPE = { w: 324, h: 324 }; // for w > h
const SIZE_NORMAL_PORTRAIT = { w: 324 * (9/16), h: 324 }; // for h > w
export enum ImageSize {
    Normal = "normal",
    Large = "large",
}

export function suggestedSize(size: ImageSize, portrait = false): { w: number, h: number} {
    switch (size) {
        case ImageSize.Large:
            return SIZE_LARGE;
        case ImageSize.Normal:
        default:
            return portrait ? SIZE_NORMAL_PORTRAIT : SIZE_NORMAL_LANDSCAPE;
    }
}
