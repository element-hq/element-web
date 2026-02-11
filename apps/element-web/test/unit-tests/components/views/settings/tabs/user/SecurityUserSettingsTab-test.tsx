/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { render } from "jest-matrix-react";
import React, { act } from "react";
import userEvent from "@testing-library/user-event";

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
import defaultDispatcher from "../../../../../../../src/dispatcher/dispatcher";

describe("<SecurityUserSettingsTab />", () => {
    const defaultProps = {
        closeSettingsFn: jest.fn(),
    };

    const getIgnoredUsers = jest.fn();
    const setIgnoredUsers = jest.fn();

    const userId = "@alice:server.org";
    const deviceId = "alices-device";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        ...mockClientMethodsDevice(deviceId),
        ...mockClientMethodsCrypto(),
        getRooms: jest.fn().mockReturnValue([]),
        getPushers: jest.fn().mockReturnValue([]),
        getIgnoredUsers,
        setIgnoredUsers,
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

    it("renders ignored users", () => {
        getIgnoredUsers.mockReturnValue(["@bob:example.org"]);
        const { getByRole } = render(getComponent());
        const ignoredUsers = getByRole("list", { name: "Ignored users" });

        expect(ignoredUsers).toMatchSnapshot();
    });

    it("allows unignoring a user", async () => {
        getIgnoredUsers.mockReturnValue(["@bob:example.org"]);
        const { getByText, getByRole } = render(getComponent());
        await userEvent.click(getByRole("button", { name: "Unignore" }));
        expect(setIgnoredUsers).toHaveBeenCalledWith([]);
        await act(() => {
            getIgnoredUsers.mockReturnValue([]);
            defaultDispatcher.dispatch(
                {
                    action: "ignore_state_changed",
                },
                true,
            );
        });
        expect(getByText("You have no ignored users.")).toBeVisible();
    });
});
