/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE in the repository root for full details.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { LAST_LEGACY_CRYPTO_VERSION, LegacyCryptoUnsupportedViewModel } from "./legacyCryptoUnsupportedViewModel";
import { MatrixDispatcher } from "../../dispatcher/dispatcher";
import SdkConfig from "../../SdkConfig";

describe("LegacyCryptoUnsupportedViewModel", () => {
    let dispatcher: MatrixDispatcher;

    beforeEach(() => {
        dispatcher = new MatrixDispatcher();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        SdkConfig.reset();
    });

    it("exposes the brand and the last supported version in the snapshot", () => {
        SdkConfig.put({ brand: "Acme Chat" });
        const vm = new LegacyCryptoUnsupportedViewModel({ dispatcher });

        expect(vm.getSnapshot()).toEqual({ brand: "Acme Chat", version: LAST_LEGACY_CRYPTO_VERSION });
    });

    it("dispatches a logout when the sign out action is invoked", () => {
        const dispatch = vi.spyOn(dispatcher, "dispatch");
        const vm = new LegacyCryptoUnsupportedViewModel({ dispatcher });

        vm.onSignOutClick();

        expect(dispatch).toHaveBeenCalledWith({ action: "logout" });
    });
});
