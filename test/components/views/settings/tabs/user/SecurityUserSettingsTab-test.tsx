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
import { render } from "@testing-library/react";
import React from "react";

import SecurityUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/SecurityUserSettingsTab";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockPlatformPeg,
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
    });

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <SecurityUserSettingsTab {...defaultProps} />
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
