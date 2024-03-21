/*
Copyright 2022 The Matrix.org Foundation C.I.C

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
