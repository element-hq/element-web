/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MockModule } from "./MockModule";
import { AppModule } from "../../../src/modules/AppModule";

describe("AppModule", () => {
    describe("constructor", () => {
        it("should call the factory immediately", () => {
            let module: MockModule | undefined;
            const appModule = new AppModule((api) => {
                if (module) {
                    throw new Error("State machine error: Factory called twice");
                }
                module = new MockModule(api);
                return module;
            });
            expect(appModule.module).toBeDefined();
            expect(appModule.module).toBe(module);
            expect(appModule.api).toBeDefined();
        });
    });
});
