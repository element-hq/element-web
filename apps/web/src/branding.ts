/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig from "./SdkConfig.ts";

/**
 * Returns whether the app is currently branded.
 * This is currently a naive check of whether the `brand` config starts with the substring `Element`,
 * which correctly covers `Element` (release), `Element Nightly` & `Element Pro`.
 */
export const isElementBranded = (): boolean => {
    const brand = SdkConfig.get("brand");
    return brand.startsWith("Element");
};
