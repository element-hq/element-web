/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _t } from "../../languageHandler";

export enum LocationShareError {
    MapStyleUrlNotConfigured = "MapStyleUrlNotConfigured",
    MapStyleUrlNotReachable = "MapStyleUrlNotReachable",
    WebGLNotEnabled = "WebGLNotEnabled",
    Default = "Default",
}

export const getLocationShareErrorMessage = (errorType?: LocationShareError): string => {
    switch (errorType) {
        case LocationShareError.MapStyleUrlNotConfigured:
            return _t("location_sharing|MapStyleUrlNotConfigured");
        case LocationShareError.WebGLNotEnabled:
            return _t("location_sharing|WebGLNotEnabled");
        case LocationShareError.MapStyleUrlNotReachable:
        default:
            return _t("location_sharing|MapStyleUrlNotReachable");
    }
};
