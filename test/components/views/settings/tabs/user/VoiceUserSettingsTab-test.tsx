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

import React from 'react';
import { mocked } from 'jest-mock';
import { render } from '@testing-library/react';

import VoiceUserSettingsTab from '../../../../../../src/components/views/settings/tabs/user/VoiceUserSettingsTab';
import MediaDeviceHandler from "../../../../../../src/MediaDeviceHandler";

jest.mock("../../../../../../src/MediaDeviceHandler");
const MediaDeviceHandlerMock = mocked(MediaDeviceHandler);

describe('<VoiceUserSettingsTab />', () => {
    const getComponent = (): React.ReactElement => (<VoiceUserSettingsTab />);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders audio processing settings', () => {
        const { getByTestId } = render(getComponent());
        expect(getByTestId('voice-auto-gain')).toBeTruthy();
        expect(getByTestId('voice-noise-suppression')).toBeTruthy();
        expect(getByTestId('voice-echo-cancellation')).toBeTruthy();
    });

    it('sets and displays audio processing settings', () => {
        MediaDeviceHandlerMock.getAudioAutoGainControl.mockReturnValue(false);
        MediaDeviceHandlerMock.getAudioEchoCancellation.mockReturnValue(true);
        MediaDeviceHandlerMock.getAudioNoiseSuppression.mockReturnValue(false);

        const { getByRole } = render(getComponent());

        getByRole("switch", { name: "Automatically adjust the microphone volume" }).click();
        getByRole("switch", { name: "Noise suppression" }).click();
        getByRole("switch", { name: "Echo cancellation" }).click();

        expect(MediaDeviceHandler.setAudioAutoGainControl).toHaveBeenCalledWith(true);
        expect(MediaDeviceHandler.setAudioEchoCancellation).toHaveBeenCalledWith(false);
        expect(MediaDeviceHandler.setAudioNoiseSuppression).toHaveBeenCalledWith(true);
    });
});
