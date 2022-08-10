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
import { render } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { DeviceInfo } from 'matrix-js-sdk/src/crypto/deviceinfo';
import { logger } from 'matrix-js-sdk/src/logger';
import { DeviceTrustLevel } from 'matrix-js-sdk/src/crypto/CrossSigning';

import SessionManagerTab from '../../../../../../src/components/views/settings/tabs/user/SessionManagerTab';
import MatrixClientContext from '../../../../../../src/contexts/MatrixClientContext';
import {
    flushPromisesWithFakeTimers,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from '../../../../../test-utils';

jest.useFakeTimers();

describe('<SessionManagerTab />', () => {
    const aliceId = '@alice:server.org';
    const deviceId = 'alices_device';

    const alicesDevice = {
        device_id: deviceId,
    };
    const alicesMobileDevice = {
        device_id: 'alices_mobile_device',
    };

    const mockCrossSigningInfo = {
        checkDeviceTrust: jest.fn(),
    };
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(aliceId),
        getStoredCrossSigningForUser: jest.fn().mockReturnValue(mockCrossSigningInfo),
        getDevices: jest.fn(),
        getStoredDevice: jest.fn(),
        getDeviceId: jest.fn().mockReturnValue(deviceId),
    });

    const defaultProps = {};
    const getComponent = (props = {}): React.ReactElement =>
        (
            <MatrixClientContext.Provider value={mockClient}>
                <SessionManagerTab {...defaultProps} {...props} />
            </MatrixClientContext.Provider>
        );

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(logger, 'error').mockRestore();
        mockClient.getDevices.mockResolvedValue({ devices: [] });
        mockClient.getStoredDevice.mockImplementation((_userId, id) => {
            const device = [alicesDevice, alicesMobileDevice].find(device => device.device_id === id);
            return device ? new DeviceInfo(device.device_id) : null;
        });
        mockCrossSigningInfo.checkDeviceTrust
            .mockReset()
            .mockReturnValue(new DeviceTrustLevel(false, false, false, false));
    });

    it('renders spinner while devices load', () => {
        const { container } = render(getComponent());
        expect(container.getElementsByClassName('mx_Spinner').length).toBeTruthy();
    });

    it('removes spinner when device fetch fails', async () => {
        mockClient.getDevices.mockRejectedValue({ httpStatus: 404 });
        const { container } = render(getComponent());
        expect(mockClient.getDevices).toHaveBeenCalled();

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });
        expect(container.getElementsByClassName('mx_Spinner').length).toBeFalsy();
    });

    it('removes spinner when device fetch fails', async () => {
        // eat the expected error log
        jest.spyOn(logger, 'error').mockImplementation(() => {});
        mockClient.getDevices.mockRejectedValue({ httpStatus: 404 });
        const { container } = render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });
        expect(container.getElementsByClassName('mx_Spinner').length).toBeFalsy();
    });

    it('does not fail when checking device verification fails', async () => {
        const logSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
        const noCryptoError = new Error("End-to-end encryption disabled");
        mockClient.getStoredDevice.mockImplementation(() => { throw noCryptoError; });
        render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        // called for each device despite error
        expect(mockClient.getStoredDevice).toHaveBeenCalledWith(aliceId, alicesDevice.device_id);
        expect(mockClient.getStoredDevice).toHaveBeenCalledWith(aliceId, alicesMobileDevice.device_id);
        expect(logSpy).toHaveBeenCalledWith('Error getting device cross-signing info', noCryptoError);
    });

    it('sets device verification status correctly', async () => {
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
        mockCrossSigningInfo.checkDeviceTrust
            // alices device is trusted
            .mockReturnValueOnce(new DeviceTrustLevel(true, true, false, false))
            // alices mobile device is not
            .mockReturnValueOnce(new DeviceTrustLevel(false, false, false, false));

        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        expect(mockCrossSigningInfo.checkDeviceTrust).toHaveBeenCalledTimes(2);
        expect(getByTestId(`device-tile-${alicesDevice.device_id}`)).toMatchSnapshot();
    });

    it('renders current session section', async () => {
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
        const noCryptoError = new Error("End-to-end encryption disabled");
        mockClient.getStoredDevice.mockImplementation(() => { throw noCryptoError; });
        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        expect(getByTestId('current-session-section')).toMatchSnapshot();
    });
});
