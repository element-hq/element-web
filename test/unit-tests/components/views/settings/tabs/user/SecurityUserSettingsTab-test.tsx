/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/
import { render } from "jest-matrix-react";
import React from "react";

import SecurityUserSettingsTab from "../../../../../../../src/components/views/settings/tabs/user/SecurityUserSettingsTab";
import MatrixClientContext from "../../../../../../../src/contexts/MatrixClientContext";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockPlatformPeg,
} from "../../../../../../test-utils";
import { SDKContext, SdkContextClass } from "../../../../../../../src/contexts/SDKContext";

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
        getKeyBackupVersion: jest.fn(),
    });

    const sdkContext = new SdkContextClass();
    sdkContext.client = mockClient;

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <SDKContext.Provider value={sdkContext}>
                <SecurityUserSettingsTab {...defaultProps} />
            </SDKContext.Provider>
        </MatrixClientContext.Provider>
    );

    beforeEach(() => {
        mockPlatformPeg();
        jest.clearAllMocks();
    });

    it("renders security section", () => {
        const { container } = render(getComponent());

        expect(container).toMatchSnapshot();
    });
});
