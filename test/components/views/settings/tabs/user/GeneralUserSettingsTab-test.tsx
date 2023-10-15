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
import { ThreepidMedium } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import GeneralUserSettingsTab from "../../../../../../src/components/views/settings/tabs/user/GeneralUserSettingsTab";
import { SdkContextClass, SDKContext } from "../../../../../../src/contexts/SDKContext";
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
import { OidcClientStore } from "../../../../../../src/stores/oidc/OidcClientStore";

describe("<GeneralUserSettingsTab />", () => {
    const defaultProps = {
        closeSettingsFn: jest.fn(),
    };

    const userId = "@alice:server.org";
    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        getCapabilities: jest.fn(),
        getThreePids: jest.fn(),
        getIdentityServerUrl: jest.fn(),
        deleteThreePid: jest.fn(),
    });

    let stores: SdkContextClass;

    const getComponent = () => (
        <SDKContext.Provider value={stores}>
            <GeneralUserSettingsTab {...defaultProps} />
        </SDKContext.Provider>
    );

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        mockPlatformPeg();
        jest.clearAllMocks();
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        jest.spyOn(logger, "error").mockRestore();

        mockClient.getCapabilities.mockResolvedValue({});
        mockClient.getThreePids.mockResolvedValue({
            threepids: [],
        });
        mockClient.deleteThreePid.mockResolvedValue({
            id_server_unbind_result: "success",
        });

        stores = new SdkContextClass();
        stores.client = mockClient;
        // stub out this store completely to avoid mocking initialisation
        const mockOidcClientStore = {} as unknown as OidcClientStore;
        jest.spyOn(stores, "oidcClientStore", "get").mockReturnValue(mockOidcClientStore);
    });

    it("does not show account management link when not available", () => {
        const { queryByTestId } = render(getComponent());

        expect(queryByTestId("external-account-management-outer")).toBeFalsy();
        expect(queryByTestId("external-account-management-link")).toBeFalsy();
    });

    it("show account management link in expected format", async () => {
        const accountManagementLink = "https://id.server.org/my-account";
        const mockOidcClientStore = {
            accountManagementEndpoint: accountManagementLink,
        } as unknown as OidcClientStore;
        jest.spyOn(stores, "oidcClientStore", "get").mockReturnValue(mockOidcClientStore);

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

            expect(screen.queryByText("Deactivate Account")).not.toBeInTheDocument();
            expect(SettingsStore.getValue).toHaveBeenCalledWith(UIFeature.Deactivate);
        });
        it("should not render section when account is managed externally", async () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Deactivate,
            );
            // account is managed externally when we have delegated auth configured
            const accountManagementLink = "https://id.server.org/my-account";
            const mockOidcClientStore = {
                accountManagementEndpoint: accountManagementLink,
            } as unknown as OidcClientStore;
            jest.spyOn(stores, "oidcClientStore", "get").mockReturnValue(mockOidcClientStore);
            render(getComponent());

            await flushPromises();

            expect(screen.queryByText("Deactivate Account")).not.toBeInTheDocument();
        });
        it("should render section when account deactivation feature is enabled", () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Deactivate,
            );
            render(getComponent());

            expect(screen.getByText("Deactivate Account", { selector: "h2" }).parentElement!).toMatchSnapshot();
        });
    });

    describe("3pids", () => {
        beforeEach(() => {
            mockClient.getCapabilities.mockResolvedValue({
                "m.3pid_changes": {
                    enabled: true,
                },
            });

            mockClient.getThreePids.mockResolvedValue({
                threepids: [
                    {
                        medium: ThreepidMedium.Email,
                        address: "test@test.io",
                        validated_at: 1685067124552,
                        added_at: 1685067124552,
                    },
                    {
                        medium: ThreepidMedium.Phone,
                        address: "123456789",
                        validated_at: 1685067124552,
                        added_at: 1685067124552,
                    },
                ],
            });

            mockClient.getIdentityServerUrl.mockReturnValue(undefined);
        });

        it("should show loaders while 3pids load", () => {
            render(getComponent());

            expect(
                within(screen.getByTestId("mx_AccountEmailAddresses")).getByLabelText("Loading…"),
            ).toBeInTheDocument();
            expect(within(screen.getByTestId("mx_AccountPhoneNumbers")).getByLabelText("Loading…")).toBeInTheDocument();
        });

        it("should display 3pid email addresses and phone numbers", async () => {
            render(getComponent());

            await flushPromises();

            expect(screen.getByTestId("mx_AccountEmailAddresses")).toMatchSnapshot();
            expect(screen.getByTestId("mx_AccountPhoneNumbers")).toMatchSnapshot();
        });

        it("should allow removing an existing email addresses", async () => {
            render(getComponent());

            await flushPromises();

            const section = screen.getByTestId("mx_AccountEmailAddresses");

            fireEvent.click(within(section).getByText("Remove"));

            // confirm removal
            expect(screen.getByText("Remove test@test.io?")).toBeInTheDocument();
            fireEvent.click(within(section).getByText("Remove"));

            expect(mockClient.deleteThreePid).toHaveBeenCalledWith(ThreepidMedium.Email, "test@test.io");
        });

        it("should allow adding a new email address", async () => {
            render(getComponent());

            await flushPromises();

            const section = screen.getByTestId("mx_AccountEmailAddresses");

            // just check the fields are enabled
            expect(within(section).getByLabelText("Email Address")).not.toBeDisabled();
            expect(within(section).getByText("Add")).not.toHaveAttribute("aria-disabled");
        });

        it("should allow removing an existing phone number", async () => {
            render(getComponent());

            await flushPromises();

            const section = screen.getByTestId("mx_AccountPhoneNumbers");

            fireEvent.click(within(section).getByText("Remove"));

            // confirm removal
            expect(screen.getByText("Remove 123456789?")).toBeInTheDocument();
            fireEvent.click(within(section).getByText("Remove"));

            expect(mockClient.deleteThreePid).toHaveBeenCalledWith(ThreepidMedium.Phone, "123456789");
        });

        it("should allow adding a new phone number", async () => {
            render(getComponent());

            await flushPromises();

            const section = screen.getByTestId("mx_AccountPhoneNumbers");

            // just check the fields are enabled
            expect(within(section).getByLabelText("Phone Number")).not.toBeDisabled();
        });

        it("should allow 3pid changes when capabilities does not have 3pid_changes", async () => {
            // We support as far back as v1.1 which doesn't have m.3pid_changes
            // so the behaviour for when it is missing has to be assume true
            mockClient.getCapabilities.mockResolvedValue({});

            render(getComponent());

            await flushPromises();

            const section = screen.getByTestId("mx_AccountEmailAddresses");

            // just check the fields are enabled
            expect(within(section).getByLabelText("Email Address")).not.toBeDisabled();
            expect(within(section).getByText("Add")).not.toHaveAttribute("aria-disabled");
        });

        describe("when 3pid changes capability is disabled", () => {
            beforeEach(() => {
                mockClient.getCapabilities.mockResolvedValue({
                    "m.3pid_changes": {
                        enabled: false,
                    },
                });
            });

            it("should not allow removing email addresses", async () => {
                render(getComponent());

                await flushPromises();

                const section = screen.getByTestId("mx_AccountEmailAddresses");

                expect(within(section).getByText("Remove")).toHaveAttribute("aria-disabled");
            });

            it("should not allow adding a new email addresses", async () => {
                render(getComponent());

                await flushPromises();

                const section = screen.getByTestId("mx_AccountEmailAddresses");

                // fields are not enabled
                expect(within(section).getByLabelText("Email Address")).toBeDisabled();
                expect(within(section).getByText("Add")).toHaveAttribute("aria-disabled");
            });

            it("should not allow removing phone numbers", async () => {
                render(getComponent());

                await flushPromises();

                const section = screen.getByTestId("mx_AccountPhoneNumbers");

                expect(within(section).getByText("Remove")).toHaveAttribute("aria-disabled");
            });

            it("should not allow adding a new phone number", async () => {
                render(getComponent());

                await flushPromises();

                const section = screen.getByTestId("mx_AccountPhoneNumbers");

                expect(within(section).getByLabelText("Phone Number")).toBeDisabled();
            });
        });
    });
});
