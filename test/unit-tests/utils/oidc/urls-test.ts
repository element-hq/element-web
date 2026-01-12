/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { getManageDeviceUrl } from "../../../../src/utils/oidc/urls";

describe("OIDC urls", () => {
    const accountManagementEndpoint = "https://auth.com/manage";
    const deviceId = "DEVICEID1234";

    describe("getManageDeviceUrl()", () => {
        it("prefers stable action", async () => {
            expect(
                getManageDeviceUrl(
                    accountManagementEndpoint,
                    ["org.matrix.session_view", "session_view", "org.matrix.device_view"],
                    deviceId,
                ),
            ).toEqual("https://auth.com/manage?action=org.matrix.device_view&device_id=DEVICEID1234");
        });
        it("defaults to unstable action", async () => {
            expect(getManageDeviceUrl(accountManagementEndpoint, [], deviceId)).toEqual(
                "https://auth.com/manage?action=org.matrix.session_view&device_id=DEVICEID1234",
            );
            expect(getManageDeviceUrl(accountManagementEndpoint, undefined, deviceId)).toEqual(
                "https://auth.com/manage?action=org.matrix.session_view&device_id=DEVICEID1234",
            );
        });
        it("uses unstable org.matrix.session_view", async () => {
            expect(getManageDeviceUrl(accountManagementEndpoint, ["org.matrix.session_view"], deviceId)).toEqual(
                "https://auth.com/manage?action=org.matrix.session_view&device_id=DEVICEID1234",
            );
        });
        it("uses unstable session_view", async () => {
            expect(getManageDeviceUrl(accountManagementEndpoint, ["session_view"], deviceId)).toEqual(
                "https://auth.com/manage?action=session_view&device_id=DEVICEID1234",
            );
        });
    });
});
