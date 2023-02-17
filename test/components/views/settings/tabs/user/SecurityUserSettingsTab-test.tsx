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
import { fireEvent, render } from "@testing-library/react";
import React from "react";

import SecurityUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/SecurityUserSettingsTab";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockPlatformPeg,
    flushPromises,
} from "../../../../../test-utils";

describe("<SecurityUserSettingsTab />", () => {
    const defaultProps = {
        closeSettingsFn: jest.fn(),
    };

    const userId = "@alice:server.org";
    const deviceId = "alices-device";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        ...mockClientMethodsDevice(deviceId),
        ...mockClientMethodsCrypto(),
        getRooms: jest.fn().mockReturnValue([]),
        getIgnoredUsers: jest.fn(),
        getVersions: jest.fn().mockResolvedValue({
            unstable_features: {
                "org.matrix.msc3882": true,
                "org.matrix.msc3886": true,
            },
        }),
    });

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <SecurityUserSettingsTab {...defaultProps} />
        </MatrixClientContext.Provider>
    );

    const settingsValueSpy = jest.spyOn(SettingsStore, "getValue");

    beforeEach(() => {
        mockPlatformPeg();
        jest.clearAllMocks();
        settingsValueSpy.mockReturnValue(false);
    });

    it("renders sessions section when new session manager is disabled", () => {
        settingsValueSpy.mockReturnValue(false);
        const { getByTestId } = render(getComponent());

        expect(getByTestId("devices-section")).toBeTruthy();
    });

    it("does not render sessions section when new session manager is enabled", () => {
        settingsValueSpy.mockReturnValue(true);
        const { queryByTestId } = render(getComponent());

        expect(queryByTestId("devices-section")).toBeFalsy();
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
