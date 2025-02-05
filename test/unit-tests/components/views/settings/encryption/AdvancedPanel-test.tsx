/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";
import { AdvancedPanel } from "../../../../../../src/components/views/settings/encryption/AdvancedPanel";
import SettingsStore from "../../../../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../../../../src/settings/SettingLevel";

describe("<AdvancedPanel />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    async function renderAdvancedPanel(onResetIdentityClick = jest.fn()) {
        const renderResult = render(
            <AdvancedPanel onResetIdentityClick={onResetIdentityClick} />,
            withClientContextRenderOptions(matrixClient),
        );
        // Wait for the device keys to be displayed
        await waitFor(() => expect(screen.getByText("ed25519")).toBeInTheDocument());
        return renderResult;
    }

    describe("<EncryptionDetails />", () => {
        it("should display a spinner when loading the device keys", async () => {
            jest.spyOn(matrixClient.getCrypto()!, "getOwnDeviceKeys").mockImplementation(() => new Promise(() => {}));
            render(<AdvancedPanel onResetIdentityClick={jest.fn()} />, withClientContextRenderOptions(matrixClient));

            expect(screen.getByTestId("encryptionDetails")).toMatchSnapshot();
        });

        it("should display the device keys", async () => {
            await renderAdvancedPanel();

            // session id
            expect(screen.getByText("ABCDEFGHI")).toBeInTheDocument();
            // session key
            expect(screen.getByText("ed25519")).toBeInTheDocument();
            expect(screen.getByTestId("encryptionDetails")).toMatchSnapshot();
        });

        it("should call the onResetIdentityClick callback when the reset cryptographic identity button is clicked", async () => {
            const user = userEvent.setup();

            const onResetIdentityClick = jest.fn();
            await renderAdvancedPanel(onResetIdentityClick);

            const resetIdentityButton = screen.getByRole("button", { name: "Reset cryptographic identity" });
            await user.click(resetIdentityButton);

            expect(onResetIdentityClick).toHaveBeenCalled();
        });
    });

    describe("<OtherSettings />", () => {
        it("should display the blacklist of unverified devices settings", async () => {
            const user = userEvent.setup();

            jest.spyOn(SettingsStore, "getValueAt").mockReturnValue(true);
            jest.spyOn(SettingsStore, "canSetValue").mockReturnValue(true);
            jest.spyOn(SettingsStore, "setValue");

            await renderAdvancedPanel();

            expect(screen.getByTestId("otherSettings")).toMatchSnapshot();
            const checkbox = screen.getByRole("checkbox", {
                name: "Never send encrypted messages to unverified devices",
            });
            expect(checkbox).toBeChecked();

            await user.click(checkbox);
            expect(SettingsStore.setValue).toHaveBeenCalledWith(
                "blacklistUnverifiedDevices",
                null,
                SettingLevel.DEVICE,
                false,
            );
        });

        it("should not display the section when the user can not set the value", async () => {
            jest.spyOn(SettingsStore, "canSetValue").mockReturnValue(false);
            jest.spyOn(SettingsStore, "setValue");

            await renderAdvancedPanel();
            expect(screen.queryByTestId("otherSettings")).toBeNull();
        });
    });
});
