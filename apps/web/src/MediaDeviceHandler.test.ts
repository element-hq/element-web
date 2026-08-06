/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { stubClient } from "test-utils";

import { SettingLevel } from "./settings/SettingLevel";
import { MatrixClientPeg } from "./MatrixClientPeg";
import MediaDeviceHandler from "./MediaDeviceHandler";
import SettingsStore from "./settings/SettingsStore";

vi.mock("./settings/SettingsStore");

const SettingsStoreMock = vi.mocked(SettingsStore);

describe("MediaDeviceHandler", () => {
    beforeEach(() => {
        stubClient();
    });

    afterEach(() => {
        vi.clearAllMocks();
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
