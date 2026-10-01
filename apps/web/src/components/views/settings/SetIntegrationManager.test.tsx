/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "test-utils-rtl";
import {
    getMockClientWithEventEmitter,
    mockClientMethodsServer,
    mockClientMethodsUser,
    flushPromises,
} from "test-utils";
import { logger } from "matrix-js-sdk/src/logger";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import SettingsStore from "../../../settings/SettingsStore";
import { UIFeature } from "../../../settings/UIFeature";
import SetIntegrationManager from "./SetIntegrationManager";
import { SettingLevel } from "../../../settings/SettingLevel";

describe("SetIntegrationManager", () => {
    const userId = "@alice:server.org";

    const mockClient = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsServer(),
        getCapabilities: vi.fn(),
        getThreePids: vi.fn(),
        getIdentityServerUrl: vi.fn(),
        deleteThreePid: vi.fn(),
    });

    const getComponent = () => (
        <MatrixClientContext.Provider value={mockClient}>
            <SetIntegrationManager />
        </MatrixClientContext.Provider>
    );

    it("should not render manage integrations section when widgets feature is disabled", () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName !== UIFeature.Widgets);
        render(getComponent());

        expect(screen.queryByTestId("mx_SetIntegrationManager")).not.toBeInTheDocument();
        expect(SettingsStore.getValue).toHaveBeenCalledWith(UIFeature.Widgets);
    });
    it("should render manage integrations sections", () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === UIFeature.Widgets);

        render(getComponent());

        expect(screen.getByTestId("mx_SetIntegrationManager")).toMatchSnapshot();
    });
    it("should update integrations provisioning on toggle", () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === UIFeature.Widgets);
        vi.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

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
        vi.spyOn(SettingsStore, "getValue").mockImplementation((settingName) => settingName === UIFeature.Widgets);
        vi.spyOn(logger, "error").mockImplementation(() => {});

        vi.spyOn(SettingsStore, "setValue").mockRejectedValue("oups");

        render(getComponent());

        const integrationSection = screen.getByTestId("mx_SetIntegrationManager");
        fireEvent.click(within(integrationSection).getByRole("switch"));

        await flushPromises();

        expect(logger.error).toHaveBeenCalledWith("Error changing integration manager provisioning");
        expect(logger.error).toHaveBeenCalledWith("oups");
        await waitFor(() => expect(within(integrationSection).getByRole("switch")).not.toBeChecked());
    });
});
