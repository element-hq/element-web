/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type RoomPreviewOpts,
    RoomViewLifecycle,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";

import {
    type MockModule,
    registerMockModule,
    registerMockModuleWithCryptoSetupExtension,
    registerMockModuleWithExperimentalExtension,
} from "./MockModule";
import { ModuleRunner } from "../../../src/modules/ModuleRunner";

describe("ModuleRunner", () => {
    afterEach(() => {
        ModuleRunner.instance.reset();
    });

    // Translations implicitly tested by ProxiedModuleApi integration tests.

    describe("invoke", () => {
        it("should invoke to every registered module", async () => {
            const module1 = registerMockModule();
            const module2 = registerMockModule();

            const wrapEmit = (module: MockModule) =>
                new Promise((resolve) => {
                    module.on(RoomViewLifecycle.PreviewRoomNotLoggedIn, (val1, val2) => {
                        resolve([val1, val2]);
                    });
                });
            const promises = Promise.all([wrapEmit(module1), wrapEmit(module2)]);

            const roomId = "!room:example.org";
            const opts: RoomPreviewOpts = { canJoin: false };
            ModuleRunner.instance.invoke(RoomViewLifecycle.PreviewRoomNotLoggedIn, opts, roomId);
            const results = await promises;
            expect(results).toEqual([
                [opts, roomId], // module 1
                [opts, roomId], // module 2
            ]);
        });
    });

    describe("extensions", () => {
        it("should return default values when no crypto-setup extensions are provided by a registered module", async () => {
            registerMockModule();
            const result = ModuleRunner.instance.extensions.cryptoSetup.getSecretStorageKey();
            expect(result).toBeNull();
        });

        it("should return default values when no experimental extensions are provided by a registered module", async () => {
            registerMockModule();
            const result = ModuleRunner.instance.extensions?.experimental.experimentalMethod();
            expect(result).toBeNull();
        });

        it("should return value from crypto-setup-extensions provided by a registered module", async () => {
            registerMockModuleWithCryptoSetupExtension();
            const result = ModuleRunner.instance.extensions.cryptoSetup.getSecretStorageKey();
            expect(result).toEqual(Uint8Array.from([0x11, 0x22, 0x99]));
        });

        it("should return value from experimental-extensions provided by a registered module", async () => {
            registerMockModuleWithExperimentalExtension();
            const result = ModuleRunner.instance.extensions.experimental.experimentalMethod();
            expect(result).toEqual(Uint8Array.from([0x22, 0x44, 0x88]));
        });

        it("must not allow multiple modules to provide cryptoSetup extension", async () => {
            registerMockModuleWithCryptoSetupExtension();
            const t = () => registerMockModuleWithCryptoSetupExtension();
            expect(t).toThrow(Error);
            expect(t).toThrow(
                "adding cryptoSetup extension implementation from module MockModuleWithCryptoSetupExtension but an implementation was already provided",
            );
        });

        it("must not allow multiple modules to provide experimental extension", async () => {
            registerMockModuleWithExperimentalExtension();
            const t = () => registerMockModuleWithExperimentalExtension();
            expect(t).toThrow(Error);
            expect(t).toThrow(
                "adding experimental extension implementation from module MockModuleWithExperimentalExtension but an implementation was already provided",
            );
        });
    });
});
