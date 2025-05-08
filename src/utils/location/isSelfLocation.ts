/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ILocationContent, LocationAssetType, M_ASSET } from "matrix-js-sdk/src/matrix";

export const isSelfLocation = (locationContent: ILocationContent): boolean => {
    const asset = M_ASSET.findIn(locationContent) as { type: string };
    const assetType = asset?.type ?? LocationAssetType.Self;
    return assetType == LocationAssetType.Self;
};
