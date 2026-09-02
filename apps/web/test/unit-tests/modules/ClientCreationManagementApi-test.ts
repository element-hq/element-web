/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import { ClientCreationManagementApi } from "../../../src/modules/ClientCreationManagementApi.ts";

describe("ClientCreationManagementApi", () => {
    it("should allow setting the CaCertsPem", () => {
        const api = new ClientCreationManagementApi();
        api.setX509ClientInitOpts({ userVerificationCaCertsPem: "test" });
        expect(api.x509?.userVerificationCaCertsPem).toEqual("test");
    });

    it("should merge successive calls", () => {
        const api = new ClientCreationManagementApi();
        const validity = (): number => 0;
        api.setX509ClientInitOpts({ userVerificationCaCertsPem: "test" });
        api.setX509ClientInitOpts({ validity });
        expect(api.x509).toEqual({ userVerificationCaCertsPem: "test", validity });
    });
});
