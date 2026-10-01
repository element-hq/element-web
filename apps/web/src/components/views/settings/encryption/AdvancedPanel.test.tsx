/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import { AdvancedPanel } from "./AdvancedPanel";
import SettingsStore from "../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../settings/SettingLevel";

describe("<AdvancedPanel />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
    });

    async function renderAdvancedPanel(onResetIdentityClick = vi.fn()) {
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
            vi.spyOn(matrixClient.getCrypto()!, "getOwnDeviceKeys").mockImplementation(() => new Promise(() => {}));
            render(<AdvancedPanel onResetIdentityClick={vi.fn()} />, withClientContextRenderOptions(matrixClient));

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

            const onResetIdentityClick = vi.fn();
            await renderAdvancedPanel(onResetIdentityClick);

            const resetIdentityButton = screen.getByRole("button", { name: "Reset cryptographic identity" });
            await user.click(resetIdentityButton);

            expect(onResetIdentityClick).toHaveBeenCalled();
        });
    });

    describe("<OtherSettings />", () => {
        it("should display the blacklist of unverified devices settings", async () => {
            const user = userEvent.setup();

            vi.spyOn(SettingsStore, "getValueAt").mockReturnValue(true);
            vi.spyOn(SettingsStore, "canSetValue").mockReturnValue(true);
            vi.spyOn(SettingsStore, "setValue");

            await renderAdvancedPanel();

            expect(screen.getByTestId("otherSettings")).toMatchSnapshot();
            const checkbox = screen.getByRole("switch", {
                name: "In encrypted rooms, only send messages to verified users",
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
            vi.spyOn(SettingsStore, "canSetValue").mockReturnValue(false);
            vi.spyOn(SettingsStore, "setValue");

            await renderAdvancedPanel();
            expect(screen.queryByTestId("otherSettings")).toBeNull();
        });
    });
});
