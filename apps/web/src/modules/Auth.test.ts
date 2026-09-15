/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vi } from "vitest";

import defaultDispatcher from "../dispatcher/dispatcher.ts";
import { overwriteAccountAuth } from "./Auth.ts";

describe("overwriteAccountAuth", () => {
    it("should call overwrite login with accountInfo", () => {
        const spy = vi.spyOn(defaultDispatcher, "dispatch");

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
