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

import { mocked } from "jest-mock";

import { SettingLevel } from "../src/settings/SettingLevel";
import { MatrixClientPeg } from "../src/MatrixClientPeg";
import { stubClient } from "./test-utils";
import MediaDeviceHandler from "../src/MediaDeviceHandler";
import SettingsStore from "../src/settings/SettingsStore";

jest.mock("../src/settings/SettingsStore");

const SettingsStoreMock = mocked(SettingsStore);

describe("MediaDeviceHandler", () => {
    beforeEach(() => {
        stubClient();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("sets audio settings", async () => {
        const expectedAudioSettings = new Map<string, boolean>([
            ["webrtc_audio_autoGainControl", false],
            ["webrtc_audio_echoCancellation", true],
            ["webrtc_audio_noiseSuppression", false],
        ]);

        SettingsStoreMock.getValue.mockImplementation((settingName): any => {
            return expectedAudioSettings.get(settingName);
        });

        await MediaDeviceHandler.setAudioAutoGainControl(false);
        await MediaDeviceHandler.setAudioEchoCancellation(true);
        await MediaDeviceHandler.setAudioNoiseSuppression(false);

        expectedAudioSettings.forEach((value, key) => {
            expect(SettingsStoreMock.setValue).toHaveBeenCalledWith(key, null, SettingLevel.DEVICE, value);
        });

        expect(MatrixClientPeg.safeGet().getMediaHandler().setAudioSettings).toHaveBeenCalledWith({
            autoGainControl: false,
            echoCancellation: true,
            noiseSuppression: false,
        });
    });
});
