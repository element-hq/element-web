/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { fireEvent, render, screen, within } from "jest-matrix-react";
import React from "react";
import { type MatrixClient, ThreepidMedium } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import userEvent from "@testing-library/user-event";
import { type MockedObject } from "jest-mock";

import AccountUserSettingsTab from "../../../../../../../src/components/views/settings/tabs/user/AccountUserSettingsTab";
import { SdkContextClass, SDKContext } from "../../../../../../../src/contexts/SDKContext";
import SettingsStore from "../../../../../../../src/settings/SettingsStore";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    mockPlatformPeg,
    flushPromises,
} from "../../../../../../test-utils";
import { UIFeature } from "../../../../../../../src/settings/UIFeature";
import { type OidcClientStore } from "../../../../../../../src/stores/oidc/OidcClientStore";
import MatrixClientContext from "../../../../../../../src/contexts/MatrixClientContext";
import Modal from "../../../../../../../src/Modal";

let changePasswordOnError: (e: Error) => void;
let changePasswordOnFinished: () => void;

jest.mock(
    "../../../../../../../src/components/views/settings/ChangePassword",
    () =>
        ({ onError, onFinished }: { onError: (e: Error) => void; onFinished: () => void }) => {
            changePasswordOnError = onError;
            changePasswordOnFinished = onFinished;
            return <button>Mock change password</button>;
        },
);

describe("<AccountUserSettingsTab />", () => {
    const defaultProps = {
        closeSettingsFn: jest.fn(),
    };

    const userId = "@alice:server.org";
    let mockClient: MockedObject<MatrixClient>;

    let stores: SdkContextClass;

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <SDKContext.Provider value={stores}>
                <AccountUserSettingsTab {...defaultProps} />
            </SDKContext.Provider>
        </MatrixClientContext.Provider>
    );

    beforeEach(() => {
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        mockPlatformPeg();
        jest.clearAllMocks();
        jest.spyOn(SettingsStore, "getValue").mockRestore();
        jest.spyOn(logger, "error").mockRestore();

        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsUser(userId),
            ...mockClientMethodsServer(),
            getCapabilities: jest.fn(),
            getThreePids: jest.fn(),
            getIdentityServerUrl: jest.fn(),
            deleteThreePid: jest.fn(),
        });

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

    afterEach(() => {
        jest.restoreAllMocks();
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

        render(getComponent());

        const manageAccountLink = await screen.findByRole("button", { name: "Manage account" });
        expect(manageAccountLink.getAttribute("href")).toMatch(accountManagementLink);
    });

    describe("deactivate account", () => {
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
        it("should display the deactivate account dialog when clicked", async () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Deactivate,
            );

            const createDialogFn = jest.fn();
            jest.spyOn(Modal, "createDialog").mockImplementation(createDialogFn);

            render(getComponent());

            await userEvent.click(screen.getByRole("button", { name: "Deactivate Account" }));

            expect(createDialogFn).toHaveBeenCalled();
        });
        it("should close settings if account deactivated", async () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Deactivate,
            );

            const createDialogFn = jest.fn();
            jest.spyOn(Modal, "createDialog").mockImplementation(createDialogFn);

            render(getComponent());

            await userEvent.click(screen.getByRole("button", { name: "Deactivate Account" }));

            createDialogFn.mock.calls[0][1].onFinished(true);

            expect(defaultProps.closeSettingsFn).toHaveBeenCalled();
        });
        it("should not close settings if account not deactivated", async () => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === UIFeature.Deactivate,
            );

            const createDialogFn = jest.fn();
            jest.spyOn(Modal, "createDialog").mockImplementation(createDialogFn);

            render(getComponent());

            await userEvent.click(screen.getByRole("button", { name: "Deactivate Account" }));

            createDialogFn.mock.calls[0][1].onFinished(false);

            expect(defaultProps.closeSettingsFn).not.toHaveBeenCalled();
        });
    });

    describe("3pids", () => {
        beforeEach(() => {
            const mockOidcClientStore = {
                accountManagementEndpoint: undefined,
            } as unknown as OidcClientStore;
            jest.spyOn(stores, "oidcClientStore", "get").mockReturnValue(mockOidcClientStore);

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

    describe("Password change", () => {
        beforeEach(() => {
            mockClient.getCapabilities.mockResolvedValue({
                "m.change_password": {
                    enabled: true,
                },
            });
        });

        it("should display a dialog if password change succeeded", async () => {
            const createDialogFn = jest.fn();
            jest.spyOn(Modal, "createDialog").mockImplementation(createDialogFn);

            render(getComponent());

            const changeButton = await screen.findByRole("button", { name: "Mock change password" });
            userEvent.click(changeButton);

            expect(changePasswordOnFinished).toBeDefined();
            changePasswordOnFinished();

            expect(createDialogFn).toHaveBeenCalledWith(expect.anything(), {
                title: "Success",
                description: "Your password was successfully changed.",
            });
        });

        it("should display an error if password change failed", async () => {
            const ERROR_STRING =
                "Your password must contain exactly 5 lowercase letters, a box drawing character and the badger emoji.";

            const createDialogFn = jest.fn();
            jest.spyOn(Modal, "createDialog").mockImplementation(createDialogFn);

            render(getComponent());

            const changeButton = await screen.findByRole("button", { name: "Mock change password" });
            userEvent.click(changeButton);

            expect(changePasswordOnError).toBeDefined();
            changePasswordOnError(new Error(ERROR_STRING));

            expect(createDialogFn).toHaveBeenCalledWith(expect.anything(), {
                title: "Error changing password",
                description: ERROR_STRING,
            });
        });
    });
});
