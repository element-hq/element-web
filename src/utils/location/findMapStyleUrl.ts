/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { logger } from "matrix-js-sdk/src/logger";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

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
