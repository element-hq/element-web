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
import { fireEvent, render, RenderResult } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { DeviceInfo } from 'matrix-js-sdk/src/crypto/deviceinfo';
import { logger } from 'matrix-js-sdk/src/logger';
import { DeviceTrustLevel } from 'matrix-js-sdk/src/crypto/CrossSigning';
import { VerificationRequest } from 'matrix-js-sdk/src/crypto/verification/request/VerificationRequest';
import { sleep } from 'matrix-js-sdk/src/utils';
import { IMyDevice } from 'matrix-js-sdk/src/matrix';

import SessionManagerTab from '../../../../../../src/components/views/settings/tabs/user/SessionManagerTab';
import MatrixClientContext from '../../../../../../src/contexts/MatrixClientContext';
import {
    flushPromisesWithFakeTimers,
    getMockClientWithEventEmitter,
    mockClientMethodsUser,
} from '../../../../../test-utils';
import Modal from '../../../../../../src/Modal';
import LogoutDialog from '../../../../../../src/components/views/dialogs/LogoutDialog';
import { DeviceWithVerification } from '../../../../../../src/components/views/settings/devices/types';

describe('<SessionManagerTab />', () => {
    const aliceId = '@alice:server.org';
    const deviceId = 'alices_device';

    const alicesDevice = {
        device_id: deviceId,
        display_name: 'Alices device',
    };
    const alicesMobileDevice = {
        device_id: 'alices_mobile_device',
        last_seen_ts: Date.now(),
    };

    const alicesOlderMobileDevice = {
        device_id: 'alices_older_mobile_device',
        last_seen_ts: Date.now() - 600000,
    };

    const mockCrossSigningInfo = {
        checkDeviceTrust: jest.fn(),
    };
    const mockVerificationRequest = { cancel: jest.fn(), on: jest.fn() } as unknown as VerificationRequest;
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(aliceId),
        getStoredCrossSigningForUser: jest.fn().mockReturnValue(mockCrossSigningInfo),
        getDevices: jest.fn(),
        getStoredDevice: jest.fn(),
        getDeviceId: jest.fn().mockReturnValue(deviceId),
        requestVerification: jest.fn().mockResolvedValue(mockVerificationRequest),
        deleteMultipleDevices: jest.fn(),
        generateClientSecret: jest.fn(),
        setDeviceDetails: jest.fn(),
    });

    const defaultProps = {};
    const getComponent = (props = {}): React.ReactElement =>
        (
            <MatrixClientContext.Provider value={mockClient}>
                <SessionManagerTab {...defaultProps} {...props} />
            </MatrixClientContext.Provider>
        );

    const toggleDeviceDetails = (
        getByTestId: ReturnType<typeof render>['getByTestId'],
        deviceId: DeviceWithVerification['device_id'],
    ) => {
        // open device detail
        const tile = getByTestId(`device-tile-${deviceId}`);
        const toggle = tile.querySelector('[aria-label="Toggle device details"]') as Element;
        fireEvent.click(toggle);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(logger, 'error').mockRestore();
        mockClient.getStoredDevice.mockImplementation((_userId, id) => {
            const device = [alicesDevice, alicesMobileDevice].find(device => device.device_id === id);
            return device ? new DeviceInfo(device.device_id) : null;
        });
        mockCrossSigningInfo.checkDeviceTrust
            .mockReset()
            .mockReturnValue(new DeviceTrustLevel(false, false, false, false));

        mockClient.getDevices
            .mockReset()
            .mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
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

    it('renders current session section with an unverified session', async () => {
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        expect(getByTestId('current-session-section')).toMatchSnapshot();
    });

    it('opens encryption setup dialog when verifiying current session', async () => {
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
        const { getByTestId } = render(getComponent());
        const modalSpy = jest.spyOn(Modal, 'createDialog');

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        // click verify button from current session section
        fireEvent.click(getByTestId(`verification-status-button-${alicesDevice.device_id}`));

        expect(modalSpy).toHaveBeenCalled();
    });

    it('renders current session section with a verified session', async () => {
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
        mockClient.getStoredDevice.mockImplementation(() => new DeviceInfo(alicesDevice.device_id));
        mockCrossSigningInfo.checkDeviceTrust
            .mockReturnValue(new DeviceTrustLevel(true, true, false, false));

        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        expect(getByTestId('current-session-section')).toMatchSnapshot();
    });

    it('does not render other sessions section when user has only one device', async () => {
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice] });
        const { queryByTestId } = render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        expect(queryByTestId('other-sessions-section')).toBeFalsy();
    });

    it('renders other sessions section when user has more than one device', async () => {
        mockClient.getDevices.mockResolvedValue({
            devices: [alicesDevice, alicesOlderMobileDevice, alicesMobileDevice],
        });
        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        expect(getByTestId('other-sessions-section')).toBeTruthy();
    });

    it('goes to filtered list from security recommendations', async () => {
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
        const { getByTestId, container } = render(getComponent());

        await act(async () => {
            await flushPromisesWithFakeTimers();
        });

        fireEvent.click(getByTestId('unverified-devices-cta'));

        // our session manager waits a tick for rerender
        await flushPromisesWithFakeTimers();

        // unverified filter is set
        expect(container.querySelector('.mx_FilteredDeviceList_header')).toMatchSnapshot();
    });

    describe('device detail expansion', () => {
        it('renders no devices expanded by default', async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesOlderMobileDevice, alicesMobileDevice],
            });
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            const otherSessionsSection = getByTestId('other-sessions-section');

            // no expanded device details
            expect(otherSessionsSection.getElementsByClassName('mx_DeviceDetails').length).toBeFalsy();
        });

        it('toggles device expansion on click', async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesOlderMobileDevice, alicesMobileDevice],
            });
            const { getByTestId, queryByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            toggleDeviceDetails(getByTestId, alicesOlderMobileDevice.device_id);

            // device details are expanded
            expect(getByTestId(`device-detail-${alicesOlderMobileDevice.device_id}`)).toBeTruthy();

            toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

            // both device details are expanded
            expect(getByTestId(`device-detail-${alicesOlderMobileDevice.device_id}`)).toBeTruthy();
            expect(getByTestId(`device-detail-${alicesMobileDevice.device_id}`)).toBeTruthy();

            toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

            // alicesMobileDevice was toggled off
            expect(queryByTestId(`device-detail-${alicesMobileDevice.device_id}`)).toBeFalsy();
            // alicesOlderMobileDevice stayed open
            expect(getByTestId(`device-detail-${alicesOlderMobileDevice.device_id}`)).toBeTruthy();
        });
    });

    describe('Device verification', () => {
        it('does not render device verification cta when current session is not verified', async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesOlderMobileDevice, alicesMobileDevice],
            });
            const { getByTestId, queryByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            toggleDeviceDetails(getByTestId, alicesOlderMobileDevice.device_id);

            // verify device button is not rendered
            expect(queryByTestId(`verification-status-button-${alicesOlderMobileDevice.device_id}`)).toBeFalsy();
        });

        it('renders device verification cta on other sessions when current session is verified', async () => {
            const modalSpy = jest.spyOn(Modal, 'createDialog');

            // make the current device verified
            mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
            mockClient.getStoredDevice.mockImplementation((_userId, deviceId) => new DeviceInfo(deviceId));
            mockCrossSigningInfo.checkDeviceTrust
                .mockImplementation((_userId, { deviceId }) => {
                    console.log('hhh', deviceId);
                    if (deviceId === alicesDevice.device_id) {
                        return new DeviceTrustLevel(true, true, false, false);
                    }
                    throw new Error('everything else unverified');
                });

            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

            // click verify button from current session section
            fireEvent.click(getByTestId(`verification-status-button-${alicesMobileDevice.device_id}`));

            expect(mockClient.requestVerification).toHaveBeenCalledWith(aliceId, [alicesMobileDevice.device_id]);
            expect(modalSpy).toHaveBeenCalled();
        });

        it('refreshes devices after verifying other device', async () => {
            const modalSpy = jest.spyOn(Modal, 'createDialog');

            // make the current device verified
            mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });
            mockClient.getStoredDevice.mockImplementation((_userId, deviceId) => new DeviceInfo(deviceId));
            mockCrossSigningInfo.checkDeviceTrust
                .mockImplementation((_userId, { deviceId }) => {
                    console.log('hhh', deviceId);
                    if (deviceId === alicesDevice.device_id) {
                        return new DeviceTrustLevel(true, true, false, false);
                    }
                    throw new Error('everything else unverified');
                });

            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

            // reset mock counter before triggering verification
            mockClient.getDevices.mockClear();

            // click verify button from current session section
            fireEvent.click(getByTestId(`verification-status-button-${alicesMobileDevice.device_id}`));

            const { onFinished: modalOnFinished } = modalSpy.mock.calls[0][1] as any;
            // simulate modal completing process
            await modalOnFinished();

            // cancelled in case it was a failure exit from modal
            expect(mockVerificationRequest.cancel).toHaveBeenCalled();
            // devices refreshed
            expect(mockClient.getDevices).toHaveBeenCalled();
        });
    });

    describe('Sign out', () => {
        it('Signs out of current device', async () => {
            const modalSpy = jest.spyOn(Modal, 'createDialog');

            mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice] });
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            toggleDeviceDetails(getByTestId, alicesDevice.device_id);

            const signOutButton = getByTestId('device-detail-sign-out-cta');
            expect(signOutButton).toMatchSnapshot();
            fireEvent.click(signOutButton);

            // logout dialog opened
            expect(modalSpy).toHaveBeenCalledWith(LogoutDialog, {}, undefined, false, true);
        });

        describe('other devices', () => {
            const interactiveAuthError = { httpStatus: 401, data: { flows: [{ stages: ["m.login.password"] }] } };

            beforeEach(() => {
                mockClient.deleteMultipleDevices.mockReset();
            });

            it('deletes a device when interactive auth is not required', async () => {
                mockClient.deleteMultipleDevices.mockResolvedValue({});
                mockClient.getDevices
                    .mockResolvedValueOnce({ devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice] })
                    // pretend it was really deleted on refresh
                    .mockResolvedValueOnce({ devices: [alicesDevice, alicesOlderMobileDevice] });

                const { getByTestId } = render(getComponent());

                await act(async () => {
                    await flushPromisesWithFakeTimers();
                });

                toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

                const deviceDetails = getByTestId(`device-detail-${alicesMobileDevice.device_id}`);
                const signOutButton = deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element;
                fireEvent.click(signOutButton);

                // sign out button is disabled with spinner
                expect((deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element).getAttribute('aria-disabled')).toEqual("true");
                // delete called
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesMobileDevice.device_id], undefined,
                );

                await flushPromisesWithFakeTimers();

                // devices refreshed
                expect(mockClient.getDevices).toHaveBeenCalled();
            });

            it('deletes a device when interactive auth is required', async () => {
                mockClient.deleteMultipleDevices
                    // require auth
                    .mockRejectedValueOnce(interactiveAuthError)
                    // then succeed
                    .mockResolvedValueOnce({});

                mockClient.getDevices
                    .mockResolvedValueOnce({ devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice] })
                    // pretend it was really deleted on refresh
                    .mockResolvedValueOnce({ devices: [alicesDevice, alicesOlderMobileDevice] });

                const { getByTestId, getByLabelText } = render(getComponent());

                await act(async () => {
                    await flushPromisesWithFakeTimers();
                });

                // reset mock count after initial load
                mockClient.getDevices.mockClear();

                toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

                const deviceDetails = getByTestId(`device-detail-${alicesMobileDevice.device_id}`);
                const signOutButton = deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element;
                fireEvent.click(signOutButton);

                await flushPromisesWithFakeTimers();
                // modal rendering has some weird sleeps
                await sleep(100);

                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesMobileDevice.device_id], undefined,
                );

                const modal = document.getElementsByClassName('mx_Dialog');
                expect(modal.length).toBeTruthy();

                // fill password and submit for interactive auth
                act(() => {
                    fireEvent.change(getByLabelText('Password'), { target: { value: 'topsecret' } });
                    fireEvent.submit(getByLabelText('Password'));
                });

                await flushPromisesWithFakeTimers();

                // called again with auth
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith([alicesMobileDevice.device_id],
                    { identifier: {
                        type: "m.id.user", user: aliceId,
                    }, password: "", type: "m.login.password", user: aliceId,
                    });
                // devices refreshed
                expect(mockClient.getDevices).toHaveBeenCalled();
            });

            it('clears loading state when device deletion is cancelled during interactive auth', async () => {
                mockClient.deleteMultipleDevices
                    // require auth
                    .mockRejectedValueOnce(interactiveAuthError)
                    // then succeed
                    .mockResolvedValueOnce({});

                mockClient.getDevices
                    .mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice] });

                const { getByTestId, getByLabelText } = render(getComponent());

                await act(async () => {
                    await flushPromisesWithFakeTimers();
                });

                toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

                const deviceDetails = getByTestId(`device-detail-${alicesMobileDevice.device_id}`);
                const signOutButton = deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element;
                fireEvent.click(signOutButton);

                // button is loading
                expect((deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element).getAttribute('aria-disabled')).toEqual("true");

                await flushPromisesWithFakeTimers();

                // Modal rendering has some weird sleeps.
                // Resetting ourselves twice in the main loop gives modal the chance to settle.
                await sleep(0);
                await sleep(0);

                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesMobileDevice.device_id], undefined,
                );

                const modal = document.getElementsByClassName('mx_Dialog');
                expect(modal.length).toBeTruthy();

                // cancel iau by closing modal
                act(() => {
                    fireEvent.click(getByLabelText('Close dialog'));
                });

                await flushPromisesWithFakeTimers();

                // not called again
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledTimes(1);
                // devices not refreshed (not called since initial fetch)
                expect(mockClient.getDevices).toHaveBeenCalledTimes(1);

                // loading state cleared
                expect((deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element).getAttribute('aria-disabled')).toEqual(null);
            });
        });
    });

    describe('Rename sessions', () => {
        const updateDeviceName = async (
            getByTestId: RenderResult['getByTestId'],
            device: IMyDevice,
            newDeviceName: string,
        ) => {
            toggleDeviceDetails(getByTestId, device.device_id);

            // start editing
            fireEvent.click(getByTestId('device-heading-rename-cta'));

            const input = getByTestId('device-rename-input');
            fireEvent.change(input, { target: { value: newDeviceName } });
            fireEvent.click(getByTestId('device-rename-submit-cta'));

            await flushPromisesWithFakeTimers();
            await flushPromisesWithFakeTimers();
        };

        it('renames current session', async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            const newDeviceName = 'new device name';
            await updateDeviceName(getByTestId, alicesDevice, newDeviceName);

            expect(mockClient.setDeviceDetails).toHaveBeenCalledWith(
                alicesDevice.device_id, { display_name: newDeviceName });

            // devices refreshed
            expect(mockClient.getDevices).toHaveBeenCalledTimes(2);
        });

        it('renames other session', async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            const newDeviceName = 'new device name';
            await updateDeviceName(getByTestId, alicesMobileDevice, newDeviceName);

            expect(mockClient.setDeviceDetails).toHaveBeenCalledWith(
                alicesMobileDevice.device_id, { display_name: newDeviceName });

            // devices refreshed
            expect(mockClient.getDevices).toHaveBeenCalledTimes(2);
        });

        it('does not rename session or refresh devices is session name is unchanged', async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            await updateDeviceName(getByTestId, alicesDevice, alicesDevice.display_name);

            expect(mockClient.setDeviceDetails).not.toHaveBeenCalled();
            // only called once on initial load
            expect(mockClient.getDevices).toHaveBeenCalledTimes(1);
        });

        it('saves an empty session display name successfully', async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            await updateDeviceName(getByTestId, alicesDevice, '');

            expect(mockClient.setDeviceDetails).toHaveBeenCalledWith(
                alicesDevice.device_id, { display_name: '' });
        });

        it('displays an error when session display name fails to save', async () => {
            const logSpy = jest.spyOn(logger, 'error');
            const error = new Error('oups');
            mockClient.setDeviceDetails.mockRejectedValue(error);
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromisesWithFakeTimers();
            });

            const newDeviceName = 'new device name';
            await updateDeviceName(getByTestId, alicesDevice, newDeviceName);

            await flushPromisesWithFakeTimers();

            expect(logSpy).toHaveBeenCalledWith("Error setting session display name", error);

            // error displayed
            expect(getByTestId('device-rename-error')).toBeTruthy();
        });
    });
});
