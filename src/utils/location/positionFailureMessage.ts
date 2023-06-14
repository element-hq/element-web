/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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
import SdkConfig from "../../SdkConfig";

/**
 * Get a localised error message for GeolocationPositionError error codes
 * @param code - error code from GeolocationPositionError
 * @returns
 */
export const positionFailureMessage = (code: number): string | undefined => {
    const brand = SdkConfig.get().brand;
    switch (code) {
        case 1:
            return _t(
                "%(brand)s was denied permission to fetch your location. " +
                    "Please allow location access in your browser settings.",
                { brand },
            );
        case 2:
            return _t("Failed to fetch your location. Please try again later.");
        case 3:
            return _t("Timed out trying to fetch your location. Please try again later.");
        case 4:
            return _t("Unknown error fetching location. Please try again later.");
    }
};
