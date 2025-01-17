/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "jest-matrix-react";
import { logger } from "matrix-js-sdk/src/logger";

import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { UIFeature } from "../../../../../src/settings/UIFeature";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    flushPromises,
} from "../../../../test-utils";
import SetIntegrationManager from "../../../../../src/components/views/settings/SetIntegrationManager";
import { SettingLevel } from "../../../../../src/settings/SettingLevel";

describe("SetIntegrationManager", () => {
    const userId = "@alice:server.org";

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        getCapabilities: jest.fn(),
        getThreePids: jest.fn(),
        getIdentityServerUrl: jest.fn(),
        deleteThreePid: jest.fn(),
    });

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <SetIntegrationManager />
        </MatrixClientContext.Provider>
    );

    it("should not render manage integrations section when widgets feature is disabled", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName !== UIFeature.Widgets);
        render(getComponent());

        expect(screen.queryByTestId("mx_SetIntegrationManager")).not.toBeInTheDocument();
        expect(SettingsStore.getValue).toHaveBeenCalledWith(UIFeature.Widgets);
    });
    it("should render manage integrations sections", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === UIFeature.Widgets);

        render(getComponent());

        expect(screen.getByTestId("mx_SetIntegrationManager")).toMatchSnapshot();
    });
    it("should update integrations provisioning on toggle", () => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === UIFeature.Widgets);
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
        jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === UIFeature.Widgets);
        jest.spyOn(logger, "error").mockImplementation(() => {});

        jest.spyOn(SettingsStore, "setValue").mockRejectedValue("oups");

        render(getComponent());

        const integrationSection = screen.getByTestId("mx_SetIntegrationManager");
        fireEvent.click(within(integrationSection).getByRole("switch"));

        await flushPromises();

        expect(logger.error).toHaveBeenCalledWith("Error changing integration manager provisioning");
        expect(logger.error).toHaveBeenCalledWith("oups");
        await waitFor(() => expect(within(integrationSection).getByRole("switch")).not.toBeChecked());
    });
});
