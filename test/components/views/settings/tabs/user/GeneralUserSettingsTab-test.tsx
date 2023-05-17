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

import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { M_AUTHENTICATION } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

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
import { UIFeature } from "../../../../../../src/settings/UIFeature";
import { SettingLevel } from "../../../../../../src/settings/SettingLevel";

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
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        jest.spyOn(logger, "error").mockRestore();
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

    describe("Manage integrations", () => {
        it("should not render manage integrations section when widgets feature is disabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName !== UIFeature.Widgets,
            );
            render(getComponent());

            expect(screen.queryByTestId("mx_SetIntegrationManager")).not.toBeInTheDocument();
            expect(SettingsStore.getValue).toHaveBeenCalledWith(UIFeature.Widgets);
        });
        it("should render manage integrations sections", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Widgets,
            );

            render(getComponent());

            expect(screen.getByTestId("mx_SetIntegrationManager")).toMatchSnapshot();
        });
        it("should update integrations provisioning on toggle", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Widgets,
            );
            jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            render(getComponent());

            const integrationSection = screen.getByTestId("mx_SetIntegrationManager");
            fireEvent.click(within(integrationSection).getByRole("switch"));

            expect(SettingsStore.setValue).toHaveBeenCalledWith(
                "integrationProvisioning",
                null,
                SettingLevel.ACCOUNT,
                true,
            );
            expect(within(integrationSection).getByRole("switch")).toBeChecked();
        });
        it("handles error when updating setting fails", async () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Widgets,
            );
            jest.spyOn(logger, "error").mockImplementation(() => {});

            jest.spyOn(SettingsStore, "setValue").mockRejectedValue("oups");

            render(getComponent());

            const integrationSection = screen.getByTestId("mx_SetIntegrationManager");
            fireEvent.click(within(integrationSection).getByRole("switch"));

            await flushPromises();

            expect(logger.error).toHaveBeenCalledWith("Error changing integration manager provisioning");
            expect(logger.error).toHaveBeenCalledWith("oups");
            expect(within(integrationSection).getByRole("switch")).not.toBeChecked();
        });
    });

    describe("deactive account", () => {
        it("should not render section when account deactivation feature is disabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName !== UIFeature.Deactivate,
            );
            render(getComponent());

            expect(screen.queryByText("Deactivate account")).not.toBeInTheDocument();
            expect(SettingsStore.getValue).toHaveBeenCalledWith(UIFeature.Deactivate);
        });
        it("should render section when account deactivation feature is enabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Deactivate,
            );
            render(getComponent());

            expect(screen.getByText("Deactivate account").parentElement!).toMatchSnapshot();
        });
    });
});
