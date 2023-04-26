/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
