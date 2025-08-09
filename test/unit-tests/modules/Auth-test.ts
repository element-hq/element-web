/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import defaultDispatcher from "../../../src/dispatcher/dispatcher.ts";
import { overwriteAccountAuth } from "../../../src/modules/Auth.ts";

describe("overwriteAccountAuth", () => {
    it("should call overwrite login with accountInfo", () => {
        const spy = jest.spyOn(defaultDispatcher, "dispatch");

        const accountInfo = {
            userId: "@user:server.com",
            deviceId: "DEVICEID",
            accessToken: "TOKEN",
            homeserverUrl: "https://server.com",
        };
        overwriteAccountAuth(accountInfo);
        expect(spy).toHaveBeenCalledWith(
            {
                action: "overwrite_login",
                credentials: expect.objectContaining(accountInfo),
            },
            true,
        );
    });
});
