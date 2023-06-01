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

import React from "react";
import { act, fireEvent, render, RenderResult } from "@testing-library/react";
import { DeviceInfo } from "matrix-js-sdk/src/crypto/deviceinfo";
import { logger } from "matrix-js-sdk/src/logger";
import { VerificationRequest } from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { defer, sleep } from "matrix-js-sdk/src/utils";
import {
    ClientEvent,
    IMyDevice,
    LOCAL_NOTIFICATION_SETTINGS_PREFIX,
    MatrixEvent,
    PUSHER_DEVICE_ID,
    PUSHER_ENABLED,
    IAuthData,
    UNSTABLE_MSC3882_CAPABILITY,
    CryptoApi,
    DeviceVerificationStatus,
} from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { clearAllModals } from "../../../../../test-utils";
import SessionManagerTab from "../../../../../../src/components/views/settings/tabs/user/SessionManagerTab";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import {
    flushPromises,
    getMockClientWithEventEmitter,
    mkPusher,
    mockClientMethodsUser,
    mockPlatformPeg,
} from "../../../../../test-utils";
import Modal from "../../../../../../src/Modal";
import LogoutDialog from "../../../../../../src/components/views/dialogs/LogoutDialog";
import { DeviceSecurityVariation, ExtendedDevice } from "../../../../../../src/components/views/settings/devices/types";
import { INACTIVE_DEVICE_AGE_MS } from "../../../../../../src/components/views/settings/devices/filter";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { getClientInformationEventType } from "../../../../../../src/utils/device/clientInformation";

mockPlatformPeg();

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

describe("<SessionManagerTab />", () => {
    const aliceId = "@alice:server.org";
    const deviceId = "alices_device";

    const alicesDevice = {
        device_id: deviceId,
        display_name: "Alices device",
    };
    const alicesMobileDevice = {
        device_id: "alices_mobile_device",
        last_seen_ts: Date.now(),
    };

    const alicesOlderMobileDevice = {
        device_id: "alices_older_mobile_device",
        last_seen_ts: Date.now() - 600000,
    };

    const alicesInactiveDevice = {
        device_id: "alices_older_inactive_mobile_device",
        last_seen_ts: Date.now() - (INACTIVE_DEVICE_AGE_MS + 1000),
    };

    const mockVerificationRequest = {
        cancel: jest.fn(),
        on: jest.fn(),
    } as unknown as VerificationRequest;

    const mockCrypto = mocked({
        getDeviceVerificationStatus: jest.fn(),
    } as unknown as CryptoApi);

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(aliceId),
        getCrypto: jest.fn().mockReturnValue(mockCrypto),
        getDevices: jest.fn(),
        getStoredDevice: jest.fn(),
        getDeviceId: jest.fn().mockReturnValue(deviceId),
        requestVerification: jest.fn().mockResolvedValue(mockVerificationRequest),
        deleteMultipleDevices: jest.fn(),
        generateClientSecret: jest.fn(),
        setDeviceDetails: jest.fn(),
        getAccountData: jest.fn(),
        deleteAccountData: jest.fn(),
        doesServerSupportUnstableFeature: jest.fn().mockResolvedValue(true),
        getPushers: jest.fn(),
        setPusher: jest.fn(),
        setLocalNotificationSettings: jest.fn(),
        getVersions: jest.fn().mockResolvedValue({}),
        getCapabilities: jest.fn().mockResolvedValue({}),
    });

    const defaultProps = {};
    const getComponent = (props = {}): React.ReactElement => (
        <MatrixClientContext.Provider value={mockClient}>
            <SessionManagerTab {...defaultProps} {...props} />
        </MatrixClientContext.Provider>
    );

    const toggleDeviceDetails = (
        getByTestId: ReturnType<typeof render>["getByTestId"],
        deviceId: ExtendedDevice["device_id"],
        isOpen?: boolean,
    ): void => {
        // open device detail
        const tile = getByTestId(`device-tile-${deviceId}`);
        const label = isOpen ? "Hide details" : "Show details";
        const toggle = tile.querySelector(`[aria-label="${label}"]`) as Element;
        fireEvent.click(toggle);
    };

    const toggleDeviceSelection = (
        getByTestId: ReturnType<typeof render>["getByTestId"],
        deviceId: ExtendedDevice["device_id"],
    ): void => {
        const checkbox = getByTestId(`device-tile-checkbox-${deviceId}`);
        fireEvent.click(checkbox);
    };

    const getDeviceTile = (
        getByTestId: ReturnType<typeof render>["getByTestId"],
        deviceId: ExtendedDevice["device_id"],
    ): HTMLElement => {
        return getByTestId(`device-tile-${deviceId}`);
    };

    const setFilter = async (container: HTMLElement, option: DeviceSecurityVariation | string) =>
        await act(async () => {
            const dropdown = container.querySelector('[aria-label="Filter devices"]');

            fireEvent.click(dropdown as Element);
            // tick to let dropdown render
            await flushPromises();

            fireEvent.click(container.querySelector(`#device-list-filter__${option}`) as Element);
        });

    const isDeviceSelected = (
        getByTestId: ReturnType<typeof render>["getByTestId"],
        deviceId: ExtendedDevice["device_id"],
    ): boolean => !!(getByTestId(`device-tile-checkbox-${deviceId}`) as HTMLInputElement).checked;

    const isSelectAllChecked = (getByTestId: ReturnType<typeof render>["getByTestId"]): boolean =>
        !!(getByTestId("device-select-all-checkbox") as HTMLInputElement).checked;

    const confirmSignout = async (
        getByTestId: ReturnType<typeof render>["getByTestId"],
        confirm = true,
    ): Promise<void> => {
        // modal has sleeps in rendering process :(
        await sleep(100);
        const buttonId = confirm ? "dialog-primary-button" : "dialog-cancel-button";
        fireEvent.click(getByTestId(buttonId));

        // flush the confirmation promise
        await flushPromises();
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.spyOn(logger, "error").mockRestore();
        mockClient.getStoredDevice.mockImplementation((_userId, id) => {
            const device = [alicesDevice, alicesMobileDevice].find((device) => device.device_id === id);
            return device ? new DeviceInfo(device.device_id) : null;
        });
        mockCrypto.getDeviceVerificationStatus.mockReset().mockResolvedValue(new DeviceVerificationStatus({}));

        mockClient.getDevices.mockReset().mockResolvedValue({ devices: [alicesDevice, alicesMobileDevice] });

        mockClient.getPushers.mockReset().mockResolvedValue({
            pushers: [
                mkPusher({
                    [PUSHER_DEVICE_ID.name]: alicesMobileDevice.device_id,
                    [PUSHER_ENABLED.name]: true,
                }),
            ],
        });

        // @ts-ignore mock
        mockClient.store = { accountData: new Map() };

        mockClient.getAccountData.mockReset().mockImplementation((eventType) => {
            if (eventType.startsWith(LOCAL_NOTIFICATION_SETTINGS_PREFIX.name)) {
                return new MatrixEvent({
                    type: eventType,
                    content: {
                        is_silenced: false,
                    },
                });
            }
        });

        // sometimes a verification modal is in modal state when these tests run
        // make sure the coast is clear
        await clearAllModals();
    });

    it("renders spinner while devices load", () => {
        const { container } = render(getComponent());
        expect(container.getElementsByClassName("mx_Spinner").length).toBeTruthy();
    });

    it("removes spinner when device fetch fails", async () => {
        // eat the expected error log
        jest.spyOn(logger, "error").mockImplementation(() => {});
        mockClient.getDevices.mockRejectedValue({ httpStatus: 404 });
        const { container } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });
        expect(container.getElementsByClassName("mx_Spinner").length).toBeFalsy();
    });

    it("sets device verification status correctly", async () => {
        mockClient.getDevices.mockResolvedValue({
            devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice],
        });
        mockClient.getStoredDevice.mockImplementation((_userId, deviceId) => new DeviceInfo(deviceId));
        mockCrypto.getDeviceVerificationStatus.mockImplementation(async (_userId, deviceId) => {
            // alices device is trusted
            if (deviceId === alicesDevice.device_id) {
                return new DeviceVerificationStatus({ crossSigningVerified: true, localVerified: true });
            }
            // alices mobile device is not
            if (deviceId === alicesMobileDevice.device_id) {
                return new DeviceVerificationStatus({});
            }
            // alicesOlderMobileDevice does not support encryption
            return null;
        });

        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        expect(mockCrypto.getDeviceVerificationStatus).toHaveBeenCalledTimes(3);
        expect(
            getByTestId(`device-tile-${alicesDevice.device_id}`).querySelector('[aria-label="Verified"]'),
        ).toBeTruthy();
        expect(
            getByTestId(`device-tile-${alicesMobileDevice.device_id}`).querySelector('[aria-label="Unverified"]'),
        ).toBeTruthy();
        // sessions that dont support encryption use unverified badge
        expect(
            getByTestId(`device-tile-${alicesOlderMobileDevice.device_id}`).querySelector('[aria-label="Unverified"]'),
        ).toBeTruthy();
    });

    it("extends device with client information when available", async () => {
        mockClient.getDevices.mockResolvedValue({
            devices: [alicesDevice, alicesMobileDevice],
        });
        mockClient.getAccountData.mockImplementation((eventType: string) => {
            const content = {
                name: "Element Web",
                version: "1.2.3",
                url: "test.com",
            };
            return new MatrixEvent({
                type: eventType,
                content,
            });
        });

        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        // twice for each device
        expect(mockClient.getAccountData).toHaveBeenCalledTimes(4);

        toggleDeviceDetails(getByTestId, alicesDevice.device_id);
        // application metadata section rendered
        expect(getByTestId("device-detail-metadata-application")).toBeTruthy();
    });

    it("renders devices without available client information without error", async () => {
        mockClient.getDevices.mockResolvedValue({
            devices: [alicesDevice, alicesMobileDevice],
        });

        const { getByTestId, queryByTestId } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        toggleDeviceDetails(getByTestId, alicesDevice.device_id);
        // application metadata section not rendered
        expect(queryByTestId("device-detail-metadata-application")).toBeFalsy();
    });

    it("does not render other sessions section when user has only one device", async () => {
        mockClient.getDevices.mockResolvedValue({ devices: [alicesDevice] });
        const { queryByTestId } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        expect(queryByTestId("other-sessions-section")).toBeFalsy();
    });

    it("renders other sessions section when user has more than one device", async () => {
        mockClient.getDevices.mockResolvedValue({
            devices: [alicesDevice, alicesOlderMobileDevice, alicesMobileDevice],
        });
        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        expect(getByTestId("other-sessions-section")).toBeTruthy();
    });

    it("goes to filtered list from security recommendations", async () => {
        mockClient.getDevices.mockResolvedValue({
            devices: [alicesDevice, alicesMobileDevice],
        });
        const { getByTestId, container } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        fireEvent.click(getByTestId("unverified-devices-cta"));

        // our session manager waits a tick for rerender
        await flushPromises();

        // unverified filter is set
        expect(container.querySelector(".mx_FilteredDeviceListHeader")).toMatchSnapshot();
    });

    describe("current session section", () => {
        it("disables current session context menu while devices are loading", () => {
            const { getByTestId } = render(getComponent());
            expect(getByTestId("current-session-menu").getAttribute("aria-disabled")).toBeTruthy();
        });

        it("disables current session context menu when there is no current device", async () => {
            mockClient.getDevices.mockResolvedValue({ devices: [] });
            const { getByTestId } = render(getComponent());
            await act(async () => {
                await flushPromises();
            });

            expect(getByTestId("current-session-menu").getAttribute("aria-disabled")).toBeTruthy();
        });

        it("renders current session section with an unverified session", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice],
            });
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            expect(getByTestId("current-session-section")).toMatchSnapshot();
        });

        it("opens encryption setup dialog when verifiying current session", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice],
            });
            const { getByTestId } = render(getComponent());
            const modalSpy = jest.spyOn(Modal, "createDialog");

            await act(async () => {
                await flushPromises();
            });

            // click verify button from current session section
            fireEvent.click(getByTestId(`verification-status-button-${alicesDevice.device_id}`));

            expect(modalSpy).toHaveBeenCalled();
        });

        it("renders current session section with a verified session", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice],
            });
            mockClient.getStoredDevice.mockImplementation(() => new DeviceInfo(alicesDevice.device_id));
            mockCrypto.getDeviceVerificationStatus.mockResolvedValue(
                new DeviceVerificationStatus({ crossSigningVerified: true, localVerified: true }),
            );

            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            expect(getByTestId("current-session-section")).toMatchSnapshot();
        });

        it("expands current session details", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice],
            });
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            fireEvent.click(getByTestId("current-session-toggle-details"));

            expect(getByTestId(`device-detail-${alicesDevice.device_id}`)).toBeTruthy();
            // only one security card rendered
            expect(getByTestId("current-session-section").querySelectorAll(".mx_DeviceSecurityCard").length).toEqual(1);
        });
    });

    describe("device detail expansion", () => {
        it("renders no devices expanded by default", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesOlderMobileDevice, alicesMobileDevice],
            });
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            const otherSessionsSection = getByTestId("other-sessions-section");

            // no expanded device details
            expect(otherSessionsSection.getElementsByClassName("mx_DeviceDetails").length).toBeFalsy();
        });

        it("toggles device expansion on click", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesOlderMobileDevice, alicesMobileDevice],
            });
            const { getByTestId, queryByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            toggleDeviceDetails(getByTestId, alicesOlderMobileDevice.device_id);

            // device details are expanded
            expect(getByTestId(`device-detail-${alicesOlderMobileDevice.device_id}`)).toBeTruthy();

            toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

            // both device details are expanded
            expect(getByTestId(`device-detail-${alicesOlderMobileDevice.device_id}`)).toBeTruthy();
            expect(getByTestId(`device-detail-${alicesMobileDevice.device_id}`)).toBeTruthy();

            // toggle closed
            toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id, true);

            // alicesMobileDevice was toggled off
            expect(queryByTestId(`device-detail-${alicesMobileDevice.device_id}`)).toBeFalsy();
            // alicesOlderMobileDevice stayed open
            expect(getByTestId(`device-detail-${alicesOlderMobileDevice.device_id}`)).toBeTruthy();
        });
    });

    describe("Device verification", () => {
        it("does not render device verification cta when current session is not verified", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesOlderMobileDevice, alicesMobileDevice],
            });
            const { getByTestId, queryByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            toggleDeviceDetails(getByTestId, alicesOlderMobileDevice.device_id);

            // verify device button is not rendered
            expect(queryByTestId(`verification-status-button-${alicesOlderMobileDevice.device_id}`)).toBeFalsy();
        });

        it("renders device verification cta on other sessions when current session is verified", async () => {
            const modalSpy = jest.spyOn(Modal, "createDialog");

            // make the current device verified
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice],
            });
            mockClient.getStoredDevice.mockImplementation((_userId, deviceId) => new DeviceInfo(deviceId));
            mockCrypto.getDeviceVerificationStatus.mockImplementation(async (_userId, deviceId) => {
                if (deviceId === alicesDevice.device_id) {
                    return new DeviceVerificationStatus({ crossSigningVerified: true, localVerified: true });
                }
                return new DeviceVerificationStatus({});
            });

            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

            // click verify button from current session section
            fireEvent.click(getByTestId(`verification-status-button-${alicesMobileDevice.device_id}`));

            expect(mockClient.requestVerification).toHaveBeenCalledWith(aliceId, [alicesMobileDevice.device_id]);
            expect(modalSpy).toHaveBeenCalled();
        });

        it("does not allow device verification on session that do not support encryption", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice],
            });
            mockClient.getStoredDevice.mockImplementation((_userId, deviceId) => new DeviceInfo(deviceId));
            mockCrypto.getDeviceVerificationStatus.mockImplementation(async (_userId, deviceId) => {
                // current session verified = able to verify other sessions
                if (deviceId === alicesDevice.device_id) {
                    return new DeviceVerificationStatus({ crossSigningVerified: true, localVerified: true });
                }
                // but alicesMobileDevice doesn't support encryption
                return null;
            });

            const { getByTestId, queryByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

            // no verify button
            expect(queryByTestId(`verification-status-button-${alicesMobileDevice.device_id}`)).toBeFalsy();
            expect(
                getByTestId(`device-detail-${alicesMobileDevice.device_id}`).getElementsByClassName(
                    "mx_DeviceSecurityCard",
                ),
            ).toMatchSnapshot();
        });

        it("refreshes devices after verifying other device", async () => {
            const modalSpy = jest.spyOn(Modal, "createDialog");

            // make the current device verified
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice],
            });
            mockClient.getStoredDevice.mockImplementation((_userId, deviceId) => new DeviceInfo(deviceId));
            mockCrypto.getDeviceVerificationStatus.mockImplementation(async (_userId, deviceId) => {
                if (deviceId === alicesDevice.device_id) {
                    return new DeviceVerificationStatus({ crossSigningVerified: true, localVerified: true });
                }
                return new DeviceVerificationStatus({});
            });

            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
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

    describe("Sign out", () => {
        it("Signs out of current device", async () => {
            const modalSpy = jest.spyOn(Modal, "createDialog");

            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice],
            });
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            toggleDeviceDetails(getByTestId, alicesDevice.device_id);

            const signOutButton = getByTestId("device-detail-sign-out-cta");
            expect(signOutButton).toMatchSnapshot();
            fireEvent.click(signOutButton);

            // logout dialog opened
            expect(modalSpy).toHaveBeenCalledWith(LogoutDialog, {}, undefined, false, true);
        });

        it("Signs out of current device from kebab menu", async () => {
            const modalSpy = jest.spyOn(Modal, "createDialog");
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice],
            });
            const { getByTestId, getByLabelText } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            fireEvent.click(getByTestId("current-session-menu"));
            fireEvent.click(getByLabelText("Sign out"));

            // logout dialog opened
            expect(modalSpy).toHaveBeenCalledWith(LogoutDialog, {}, undefined, false, true);
        });

        it("does not render sign out other devices option when only one device", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice],
            });
            const { getByTestId, queryByLabelText } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            fireEvent.click(getByTestId("current-session-menu"));
            expect(queryByLabelText("Sign out of all other sessions")).toBeFalsy();
        });

        it("signs out of all other devices from current session context menu", async () => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice],
            });
            const { getByTestId, getByLabelText } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            fireEvent.click(getByTestId("current-session-menu"));
            fireEvent.click(getByLabelText("Sign out of all other sessions (2)"));
            await confirmSignout(getByTestId);

            // other devices deleted, excluding current device
            expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                [alicesMobileDevice.device_id, alicesOlderMobileDevice.device_id],
                undefined,
            );
        });

        it("removes account data events for devices after sign out", async () => {
            const mobileDeviceClientInfo = new MatrixEvent({
                type: getClientInformationEventType(alicesMobileDevice.device_id),
                content: {
                    name: "test",
                },
            });
            // @ts-ignore setup mock
            mockClient.store = {
                // @ts-ignore setup mock
                accountData: new Map([[mobileDeviceClientInfo.getType(), mobileDeviceClientInfo]]),
            };

            mockClient.getDevices
                .mockResolvedValueOnce({
                    devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice],
                })
                .mockResolvedValueOnce({
                    // refreshed devices after sign out
                    devices: [alicesDevice],
                });

            const { getByTestId, getByLabelText } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            expect(mockClient.deleteAccountData).not.toHaveBeenCalled();

            fireEvent.click(getByTestId("current-session-menu"));
            fireEvent.click(getByLabelText("Sign out of all other sessions (2)"));
            await confirmSignout(getByTestId);

            // only called once for signed out device with account data event
            expect(mockClient.deleteAccountData).toHaveBeenCalledTimes(1);
            expect(mockClient.deleteAccountData).toHaveBeenCalledWith(mobileDeviceClientInfo.getType());
        });

        describe("other devices", () => {
            const interactiveAuthError = {
                httpStatus: 401,
                data: { flows: [{ stages: ["m.login.password"] }] },
            };

            beforeEach(() => {
                mockClient.deleteMultipleDevices.mockReset();
            });

            it("deletes a device when interactive auth is not required", async () => {
                mockClient.deleteMultipleDevices.mockResolvedValue({});
                mockClient.getDevices
                    .mockResolvedValueOnce({
                        devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice],
                    })
                    // pretend it was really deleted on refresh
                    .mockResolvedValueOnce({
                        devices: [alicesDevice, alicesOlderMobileDevice],
                    });

                const { getByTestId } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

                const deviceDetails = getByTestId(`device-detail-${alicesMobileDevice.device_id}`);
                const signOutButton = deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element;
                fireEvent.click(signOutButton);

                await confirmSignout(getByTestId);

                // sign out button is disabled with spinner
                expect(
                    (deviceDetails.querySelector('[data-testid="device-detail-sign-out-cta"]') as Element).getAttribute(
                        "aria-disabled",
                    ),
                ).toEqual("true");
                // delete called
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesMobileDevice.device_id],
                    undefined,
                );

                await flushPromises();

                // devices refreshed
                expect(mockClient.getDevices).toHaveBeenCalled();
            });

            it("does not delete a device when interactive auth is not required", async () => {
                const { getByTestId } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

                const deviceDetails = getByTestId(`device-detail-${alicesMobileDevice.device_id}`);
                const signOutButton = deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element;
                fireEvent.click(signOutButton);

                await confirmSignout(getByTestId, false);

                // doesnt enter loading state
                expect(
                    (deviceDetails.querySelector('[data-testid="device-detail-sign-out-cta"]') as Element).getAttribute(
                        "aria-disabled",
                    ),
                ).toEqual(null);
                // delete not called
                expect(mockClient.deleteMultipleDevices).not.toHaveBeenCalled();
            });

            it("deletes a device when interactive auth is required", async () => {
                mockClient.deleteMultipleDevices
                    // require auth
                    .mockRejectedValueOnce(interactiveAuthError)
                    // then succeed
                    .mockResolvedValueOnce({});

                mockClient.getDevices
                    .mockResolvedValueOnce({
                        devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice],
                    })
                    // pretend it was really deleted on refresh
                    .mockResolvedValueOnce({
                        devices: [alicesDevice, alicesOlderMobileDevice],
                    });

                const { getByTestId, getByLabelText } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                // reset mock count after initial load
                mockClient.getDevices.mockClear();

                toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

                const deviceDetails = getByTestId(`device-detail-${alicesMobileDevice.device_id}`);
                const signOutButton = deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element;
                fireEvent.click(signOutButton);
                await confirmSignout(getByTestId);

                await flushPromises();
                // modal rendering has some weird sleeps
                await sleep(100);

                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesMobileDevice.device_id],
                    undefined,
                );

                const modal = document.getElementsByClassName("mx_Dialog");
                expect(modal.length).toBeTruthy();

                // fill password and submit for interactive auth
                act(() => {
                    fireEvent.change(getByLabelText("Password"), {
                        target: { value: "topsecret" },
                    });
                    fireEvent.submit(getByLabelText("Password"));
                });

                await flushPromises();

                // called again with auth
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith([alicesMobileDevice.device_id], {
                    identifier: {
                        type: "m.id.user",
                        user: aliceId,
                    },
                    password: "",
                    type: "m.login.password",
                    user: aliceId,
                });
                // devices refreshed
                expect(mockClient.getDevices).toHaveBeenCalled();
            });

            it("clears loading state when device deletion is cancelled during interactive auth", async () => {
                mockClient.deleteMultipleDevices
                    // require auth
                    .mockRejectedValueOnce(interactiveAuthError)
                    // then succeed
                    .mockResolvedValueOnce({});

                mockClient.getDevices.mockResolvedValue({
                    devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice],
                });

                const { getByTestId, getByLabelText } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

                const deviceDetails = getByTestId(`device-detail-${alicesMobileDevice.device_id}`);
                const signOutButton = deviceDetails.querySelector(
                    '[data-testid="device-detail-sign-out-cta"]',
                ) as Element;
                fireEvent.click(signOutButton);
                await confirmSignout(getByTestId);

                // button is loading
                expect(
                    (deviceDetails.querySelector('[data-testid="device-detail-sign-out-cta"]') as Element).getAttribute(
                        "aria-disabled",
                    ),
                ).toEqual("true");

                await flushPromises();

                // Modal rendering has some weird sleeps.
                // Resetting ourselves twice in the main loop gives modal the chance to settle.
                await sleep(0);
                await sleep(0);

                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesMobileDevice.device_id],
                    undefined,
                );

                const modal = document.getElementsByClassName("mx_Dialog");
                expect(modal.length).toBeTruthy();

                // cancel iau by closing modal
                act(() => {
                    fireEvent.click(getByLabelText("Close dialog"));
                });

                await flushPromises();

                // not called again
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledTimes(1);
                // devices not refreshed (not called since initial fetch)
                expect(mockClient.getDevices).toHaveBeenCalledTimes(1);

                // loading state cleared
                expect(
                    (deviceDetails.querySelector('[data-testid="device-detail-sign-out-cta"]') as Element).getAttribute(
                        "aria-disabled",
                    ),
                ).toEqual(null);
            });

            it("deletes multiple devices", async () => {
                mockClient.getDevices.mockResolvedValue({
                    devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice, alicesInactiveDevice],
                });
                // get a handle for resolving the delete call
                // because promise flushing after the confirm modal is resolving this too
                // and we want to test the loading state here
                const resolveDeleteRequest = defer<IAuthData>();
                mockClient.deleteMultipleDevices.mockImplementation(() => {
                    return resolveDeleteRequest.promise;
                });

                const { getByTestId } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                toggleDeviceSelection(getByTestId, alicesMobileDevice.device_id);
                toggleDeviceSelection(getByTestId, alicesOlderMobileDevice.device_id);

                fireEvent.click(getByTestId("sign-out-selection-cta"));

                await confirmSignout(getByTestId);

                // buttons disabled in list header
                expect(getByTestId("sign-out-selection-cta").getAttribute("aria-disabled")).toBeTruthy();
                expect(getByTestId("cancel-selection-cta").getAttribute("aria-disabled")).toBeTruthy();
                // spinner rendered in list header
                expect(getByTestId("sign-out-selection-cta").querySelector(".mx_Spinner")).toBeTruthy();

                // spinners on signing out devices
                expect(
                    getDeviceTile(getByTestId, alicesMobileDevice.device_id).querySelector(".mx_Spinner"),
                ).toBeTruthy();
                expect(
                    getDeviceTile(getByTestId, alicesOlderMobileDevice.device_id).querySelector(".mx_Spinner"),
                ).toBeTruthy();
                // no spinner for device that is not signing out
                expect(
                    getDeviceTile(getByTestId, alicesInactiveDevice.device_id).querySelector(".mx_Spinner"),
                ).toBeFalsy();

                // delete called with both ids
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesMobileDevice.device_id, alicesOlderMobileDevice.device_id],
                    undefined,
                );

                resolveDeleteRequest.resolve({});
            });

            it("signs out of all other devices from other sessions context menu", async () => {
                mockClient.getDevices.mockResolvedValue({
                    devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice],
                });
                const { getByTestId, getByLabelText } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                fireEvent.click(getByTestId("other-sessions-menu"));
                fireEvent.click(getByLabelText("Sign out of 2 sessions"));
                await confirmSignout(getByTestId);

                // other devices deleted, excluding current device
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesMobileDevice.device_id, alicesOlderMobileDevice.device_id],
                    undefined,
                );
            });
        });
    });

    describe("Rename sessions", () => {
        const updateDeviceName = async (
            getByTestId: RenderResult["getByTestId"],
            device: IMyDevice,
            newDeviceName: string,
        ) => {
            toggleDeviceDetails(getByTestId, device.device_id);

            // start editing
            fireEvent.click(getByTestId("device-heading-rename-cta"));

            const input = getByTestId("device-rename-input");
            fireEvent.change(input, { target: { value: newDeviceName } });
            fireEvent.click(getByTestId("device-rename-submit-cta"));

            await flushPromises();
            await flushPromises();
        };

        it("renames current session", async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            const newDeviceName = "new device name";
            await updateDeviceName(getByTestId, alicesDevice, newDeviceName);

            expect(mockClient.setDeviceDetails).toHaveBeenCalledWith(alicesDevice.device_id, {
                display_name: newDeviceName,
            });

            // devices refreshed
            expect(mockClient.getDevices).toHaveBeenCalledTimes(2);
        });

        it("renames other session", async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            const newDeviceName = "new device name";
            await updateDeviceName(getByTestId, alicesMobileDevice, newDeviceName);

            expect(mockClient.setDeviceDetails).toHaveBeenCalledWith(alicesMobileDevice.device_id, {
                display_name: newDeviceName,
            });

            // devices refreshed
            expect(mockClient.getDevices).toHaveBeenCalledTimes(2);
        });

        it("does not rename session or refresh devices is session name is unchanged", async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            await updateDeviceName(getByTestId, alicesDevice, alicesDevice.display_name);

            expect(mockClient.setDeviceDetails).not.toHaveBeenCalled();
            // only called once on initial load
            expect(mockClient.getDevices).toHaveBeenCalledTimes(1);
        });

        it("saves an empty session display name successfully", async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            await updateDeviceName(getByTestId, alicesDevice, "");

            expect(mockClient.setDeviceDetails).toHaveBeenCalledWith(alicesDevice.device_id, {
                display_name: "",
            });
        });

        it("displays an error when session display name fails to save", async () => {
            const logSpy = jest.spyOn(logger, "error");
            const error = new Error("oups");
            mockClient.setDeviceDetails.mockRejectedValue(error);
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            const newDeviceName = "new device name";
            await updateDeviceName(getByTestId, alicesDevice, newDeviceName);

            await flushPromises();

            expect(logSpy).toHaveBeenCalledWith("Error setting session display name", error);

            // error displayed
            expect(getByTestId("device-rename-error")).toBeTruthy();
        });
    });

    describe("Multiple selection", () => {
        beforeEach(() => {
            mockClient.getDevices.mockResolvedValue({
                devices: [alicesDevice, alicesMobileDevice, alicesOlderMobileDevice],
            });
        });

        it("toggles session selection", async () => {
            const { getByTestId, getByText } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            toggleDeviceSelection(getByTestId, alicesMobileDevice.device_id);
            toggleDeviceSelection(getByTestId, alicesOlderMobileDevice.device_id);

            // header displayed correctly
            expect(getByText("2 sessions selected")).toBeTruthy();

            expect(isDeviceSelected(getByTestId, alicesMobileDevice.device_id)).toBeTruthy();
            expect(isDeviceSelected(getByTestId, alicesOlderMobileDevice.device_id)).toBeTruthy();

            toggleDeviceSelection(getByTestId, alicesMobileDevice.device_id);

            // unselected
            expect(isDeviceSelected(getByTestId, alicesMobileDevice.device_id)).toBeFalsy();
            // still selected
            expect(isDeviceSelected(getByTestId, alicesOlderMobileDevice.device_id)).toBeTruthy();
        });

        it("cancel button clears selection", async () => {
            const { getByTestId, getByText } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            toggleDeviceSelection(getByTestId, alicesMobileDevice.device_id);
            toggleDeviceSelection(getByTestId, alicesOlderMobileDevice.device_id);

            // header displayed correctly
            expect(getByText("2 sessions selected")).toBeTruthy();

            fireEvent.click(getByTestId("cancel-selection-cta"));

            // unselected
            expect(isDeviceSelected(getByTestId, alicesMobileDevice.device_id)).toBeFalsy();
            expect(isDeviceSelected(getByTestId, alicesOlderMobileDevice.device_id)).toBeFalsy();
        });

        it("changing the filter clears selection", async () => {
            const { getByTestId } = render(getComponent());

            await act(async () => {
                await flushPromises();
            });

            toggleDeviceSelection(getByTestId, alicesMobileDevice.device_id);
            expect(isDeviceSelected(getByTestId, alicesMobileDevice.device_id)).toBeTruthy();

            fireEvent.click(getByTestId("unverified-devices-cta"));

            // our session manager waits a tick for rerender
            await flushPromises();

            // unselected
            expect(isDeviceSelected(getByTestId, alicesOlderMobileDevice.device_id)).toBeFalsy();
        });

        describe("toggling select all", () => {
            it("selects all sessions when there is not existing selection", async () => {
                const { getByTestId, getByText } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                fireEvent.click(getByTestId("device-select-all-checkbox"));

                // header displayed correctly
                expect(getByText("2 sessions selected")).toBeTruthy();
                expect(isSelectAllChecked(getByTestId)).toBeTruthy();

                // devices selected
                expect(isDeviceSelected(getByTestId, alicesMobileDevice.device_id)).toBeTruthy();
                expect(isDeviceSelected(getByTestId, alicesOlderMobileDevice.device_id)).toBeTruthy();
            });

            it("selects all sessions when some sessions are already selected", async () => {
                const { getByTestId, getByText } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                toggleDeviceSelection(getByTestId, alicesMobileDevice.device_id);

                fireEvent.click(getByTestId("device-select-all-checkbox"));

                // header displayed correctly
                expect(getByText("2 sessions selected")).toBeTruthy();
                expect(isSelectAllChecked(getByTestId)).toBeTruthy();

                // devices selected
                expect(isDeviceSelected(getByTestId, alicesMobileDevice.device_id)).toBeTruthy();
                expect(isDeviceSelected(getByTestId, alicesOlderMobileDevice.device_id)).toBeTruthy();
            });

            it("deselects all sessions when all sessions are selected", async () => {
                const { getByTestId, getByText } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                fireEvent.click(getByTestId("device-select-all-checkbox"));

                // header displayed correctly
                expect(getByText("2 sessions selected")).toBeTruthy();
                expect(isSelectAllChecked(getByTestId)).toBeTruthy();

                // devices selected
                expect(isDeviceSelected(getByTestId, alicesMobileDevice.device_id)).toBeTruthy();
                expect(isDeviceSelected(getByTestId, alicesOlderMobileDevice.device_id)).toBeTruthy();
            });

            it("selects only sessions that are part of the active filter", async () => {
                mockClient.getDevices.mockResolvedValue({
                    devices: [alicesDevice, alicesMobileDevice, alicesInactiveDevice],
                });
                const { getByTestId, container } = render(getComponent());

                await act(async () => {
                    await flushPromises();
                });

                // filter for inactive sessions
                await setFilter(container, DeviceSecurityVariation.Inactive);

                // select all inactive sessions
                fireEvent.click(getByTestId("device-select-all-checkbox"));

                expect(isSelectAllChecked(getByTestId)).toBeTruthy();

                // sign out of all selected sessions
                fireEvent.click(getByTestId("sign-out-selection-cta"));
                await confirmSignout(getByTestId);

                // only called with session from active filter
                expect(mockClient.deleteMultipleDevices).toHaveBeenCalledWith(
                    [alicesInactiveDevice.device_id],
                    undefined,
                );
            });
        });
    });

    it("lets you change the pusher state", async () => {
        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        toggleDeviceDetails(getByTestId, alicesMobileDevice.device_id);

        // device details are expanded
        expect(getByTestId(`device-detail-${alicesMobileDevice.device_id}`)).toBeTruthy();
        expect(getByTestId("device-detail-push-notification")).toBeTruthy();

        const checkbox = getByTestId("device-detail-push-notification-checkbox");

        expect(checkbox).toBeTruthy();
        fireEvent.click(checkbox);

        expect(mockClient.setPusher).toHaveBeenCalled();
    });

    it("lets you change the local notification settings state", async () => {
        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        toggleDeviceDetails(getByTestId, alicesDevice.device_id);

        // device details are expanded
        expect(getByTestId(`device-detail-${alicesDevice.device_id}`)).toBeTruthy();
        expect(getByTestId("device-detail-push-notification")).toBeTruthy();

        const checkbox = getByTestId("device-detail-push-notification-checkbox");

        expect(checkbox).toBeTruthy();
        fireEvent.click(checkbox);

        expect(mockClient.setLocalNotificationSettings).toHaveBeenCalledWith(alicesDevice.device_id, {
            is_silenced: true,
        });
    });

    it("updates the UI when another session changes the local notifications", async () => {
        const { getByTestId } = render(getComponent());

        await act(async () => {
            await flushPromises();
        });

        toggleDeviceDetails(getByTestId, alicesDevice.device_id);

        // device details are expanded
        expect(getByTestId(`device-detail-${alicesDevice.device_id}`)).toBeTruthy();
        expect(getByTestId("device-detail-push-notification")).toBeTruthy();

        const checkbox = getByTestId("device-detail-push-notification-checkbox");

        expect(checkbox).toBeTruthy();

        expect(checkbox.getAttribute("aria-checked")).toEqual("true");

        const evt = new MatrixEvent({
            type: LOCAL_NOTIFICATION_SETTINGS_PREFIX.name + "." + alicesDevice.device_id,
            content: {
                is_silenced: true,
            },
        });

        await act(async () => {
            mockClient.emit(ClientEvent.AccountData, evt);
        });

        expect(checkbox.getAttribute("aria-checked")).toEqual("false");
    });

    describe("QR code login", () => {
        const settingsValueSpy = jest.spyOn(SettingsStore, "getValue");

        beforeEach(() => {
            settingsValueSpy.mockClear().mockReturnValue(false);
            // enable server support for qr login
            mockClient.getVersions.mockResolvedValue({
                versions: [],
                unstable_features: {
                    "org.matrix.msc3886": true,
                },
            });
            mockClient.getCapabilities.mockResolvedValue({
                [UNSTABLE_MSC3882_CAPABILITY.name]: {
                    enabled: true,
                },
            });
        });

        it("renders qr code login section", async () => {
            const { getByText } = render(getComponent());

            // wait for versions call to settle
            await flushPromises();

            expect(getByText("Sign in with QR code")).toBeTruthy();
        });

        it("enters qr code login section when show QR code button clicked", async () => {
            const { getByText, getByTestId } = render(getComponent());
            // wait for versions call to settle
            await flushPromises();

            fireEvent.click(getByText("Show QR code"));

            expect(getByTestId("login-with-qr")).toBeTruthy();
        });
    });
});
