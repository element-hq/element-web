/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../SdkConfig";

export function isPresenceEnabled(matrixClient: MatrixClient): boolean {
    const hsUrl = matrixClient.baseUrl;
    const urls = SdkConfig.get("enable_presence_by_hs_url");
    if (!urls) return true;
    if (urls[hsUrl] || urls[hsUrl] === undefined) return true;
    return false;
}
