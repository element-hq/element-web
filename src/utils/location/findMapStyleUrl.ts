/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import SdkConfig from "../../SdkConfig";
import { getTileServerWellKnown } from "../WellKnownUtils";
import { LocationShareError } from "./LocationShareErrors";

/**
 * Look up what map tile server style URL was provided in the homeserver's
 * .well-known location, or, failing that, in our local config, or, failing
 * that, defaults to the same tile server listed by matrix.org.
 */
export function findMapStyleUrl(matrixClient: MatrixClient): string {
    const mapStyleUrl = getTileServerWellKnown(matrixClient)?.map_style_url ?? SdkConfig.get().map_style_url;

    if (!mapStyleUrl) {
        logger.error("'map_style_url' missing from homeserver .well-known area, and missing from from config.json.");
        throw new Error(LocationShareError.MapStyleUrlNotConfigured);
    }

    return mapStyleUrl;
}
