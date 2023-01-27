/*
Copyright 2023 The Matrix.org Foundation C.I.C.
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
import { M_AUTHENTICATION } from "matrix-js-sdk/src/matrix";

import GeneralUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/GeneralUserSettingsTab";
import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockPlatformPeg,
    flushPromises,
} from "../../../../../test-utils";

describe("<GeneralUserSettingsTab />", () => {
    const defaultProps = {
        closeSettingsFn: jest.fn(),
    };

    const userId = "@alice:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
    });

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <GeneralUserSettingsTab {...defaultProps} />
        </MatrixClientContext.Provider>
    );

    jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
    const clientWellKnownSpy = jest.spyOn(mockClient, "getClientWellKnown");

    beforeEach(() => {
        mockPlatformPeg();
        jest.clearAllMocks();
        clientWellKnownSpy.mockReturnValue({});
    });

    it("does not show account management link when not available", () => {
        const { queryByTestId } = render(getComponent());

        expect(queryByTestId("external-account-management-outer")).toBeFalsy();
        expect(queryByTestId("external-account-management-link")).toBeFalsy();
    });

    it("show account management link in expected format", async () => {
        const accountManagementLink = "https://id.server.org/my-account";
        clientWellKnownSpy.mockReturnValue({
            [M_AUTHENTICATION.name]: {
                issuer: "https://id.server.org",
                account: accountManagementLink,
            },
        });
        const { getByTestId } = render(getComponent());

        // wait for well-known call to settle
        await flushPromises();

        expect(getByTestId("external-account-management-outer").textContent).toMatch(/.*id\.server\.org/);
        expect(getByTestId("external-account-management-link").getAttribute("href")).toMatch(accountManagementLink);
    });
});
