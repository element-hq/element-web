/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig from "../../../src/SdkConfig";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { Features } from "../../../src/settings/Settings";
import SettingsStore from "../../../src/settings/SettingsStore";
import { getChunkLength } from "../../../src/voice-broadcast/utils/getChunkLength";

describe("getChunkLength", () => {
    afterEach(() => {
        SdkConfig.reset();
    });

    describe("when there is a value provided by Sdk config", () => {
        beforeEach(() => {
            SdkConfig.add({
                voice_broadcast: {
                    chunk_length: 42,
                },
            });
        });

        it("should return this value", () => {
            expect(getChunkLength()).toBe(42);
        });
    });

    describe("when Sdk config does not provide a value", () => {
        beforeEach(() => {
            SdkConfig.add({
                voice_broadcast: {
                    chunk_length: 23,
                },
            });
        });

        it("should return this value", () => {
            expect(getChunkLength()).toBe(23);
        });
    });

    describe("when there are no defaults", () => {
        it("should return the fallback value", () => {
            expect(getChunkLength()).toBe(120);
        });
    });

    describe("when the Features.VoiceBroadcastForceSmallChunks is enabled", () => {
        beforeEach(async () => {
            await SettingsStore.setValue(Features.VoiceBroadcastForceSmallChunks, null, SettingLevel.DEVICE, true);
        });

        it("should return a chunk length of 15 seconds", () => {
            expect(getChunkLength()).toBe(15);
        });
    });
});
