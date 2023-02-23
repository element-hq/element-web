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

import { IMyDevice, MatrixClient } from "matrix-js-sdk/src/matrix";

export const isDeviceVerified = (device: IMyDevice, client: MatrixClient): boolean | null => {
    try {
        const crossSigningInfo = client.getStoredCrossSigningForUser(client.getSafeUserId());
        const deviceInfo = client.getStoredDevice(client.getSafeUserId(), device.device_id);

        // no cross-signing or device info available
        if (!crossSigningInfo || !deviceInfo) return false;

        return crossSigningInfo.checkDeviceTrust(crossSigningInfo, deviceInfo, false, true).isCrossSigningVerified();
    } catch (e) {
        console.error("Error getting device cross-signing info", e);
        return null;
    }
};
