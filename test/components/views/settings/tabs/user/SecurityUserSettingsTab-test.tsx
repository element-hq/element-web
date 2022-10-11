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
import { render } from '@testing-library/react';
import React from 'react';

import SecurityUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/SecurityUserSettingsTab";
import SettingsStore from '../../../../../../src/settings/SettingsStore';
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockPlatformPeg,
} from '../../../../../test-utils';

describe('<SecurityUserSettingsTab />', () => {
    const defaultProps = {
        closeSettingsFn: jest.fn(),
    };
    const getComponent = () => <SecurityUserSettingsTab {...defaultProps} />;

    const userId = '@alice:server.org';
    const deviceId = 'alices-device';
    getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        ...mockClientMethodsDevice(deviceId),
        ...mockClientMethodsCrypto(),
        getRooms: jest.fn().mockReturnValue([]),
        getIgnoredUsers: jest.fn(),
    });

    const settingsValueSpy = jest.spyOn(SettingsStore, 'getValue');

    beforeEach(() => {
        mockPlatformPeg();
        jest.clearAllMocks();
        settingsValueSpy.mockReturnValue(false);
    });

    it('renders sessions section when new session manager is disabled', () => {
        settingsValueSpy.mockReturnValue(false);
        const { getByTestId } = render(getComponent());

        expect(getByTestId('devices-section')).toBeTruthy();
    });

    it('does not render sessions section when new session manager is enabled', () => {
        settingsValueSpy.mockReturnValue(true);
        const { queryByTestId } = render(getComponent());

        expect(queryByTestId('devices-section')).toBeFalsy();
    });
});
