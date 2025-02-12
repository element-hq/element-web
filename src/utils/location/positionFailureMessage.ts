/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
            return _t("location_sharing|failed_permission", { brand });
        case 2:
            return _t("location_sharing|failed_generic");
        case 3:
            return _t("location_sharing|failed_timeout");
        case 4:
            return _t("location_sharing|failed_unknown");
    }
};
