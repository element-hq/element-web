/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { render, type RenderResult, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import React from "react";
import { type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { vi, describe, it, expect, beforeEach, afterEach, type MockedObject } from "vitest";

import { filterConsole, stubClient } from "test-utils";
import CreateSecretStorageDialog from "./CreateSecretStorageDialog";

describe("CreateSecretStorageDialog", () => {
    let mockClient: MockedObject<MatrixClient>;

    beforeEach(() => {
        mockClient = vi.mocked(stubClient());
        mockClient.uploadDeviceSigningKeys.mockImplementation(async () => {
            await sleep(0); // CreateSecretStorageDialog doesn't expect this to resolve immediately
            throw new MatrixError({ flows: [] });
        });
        // Mock the clipboard API
        document.execCommand = vi.fn().mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function renderComponent(
        props: Partial<React.ComponentProps<typeof CreateSecretStorageDialog>> = {},
    ): RenderResult {
        const onFinished = vi.fn();
        return render(<CreateSecretStorageDialog onFinished={onFinished} {...props} />);
    }

    it("handles the happy path", async () => {
        const result = renderComponent();
        await result.findByText(
            "Safeguard against losing access to encrypted messages & data by backing up encryption keys on your server.",
        );
        expect(result.container).toMatchSnapshot();
        await userEvent.click(result.getByRole("button", { name: "Continue" }));

        await screen.findByText("Save your Recovery Key");
        expect(result.container).toMatchSnapshot();
        // Copy the key to enable the continue button
        await userEvent.click(screen.getByRole("button", { name: "Copy" }));
        expect(result.queryByText("Copied!")).not.toBeNull();
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));

        await screen.findByText("Your keys are now being backed up from this device.");
    });

    it("when there is an error when bootstraping the secret storage, it shows an error", async () => {
        vi.spyOn(mockClient.getCrypto()!, "bootstrapSecretStorage").mockRejectedValue(new Error("error"));

        renderComponent();
        await screen.findByText(
            "Safeguard against losing access to encrypted messages & data by backing up encryption keys on your server.",
        );
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));
        await screen.findByText("Save your Recovery Key");
        await userEvent.click(screen.getByRole("button", { name: "Copy" }));
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));

        await expect(screen.findByText("Unable to set up secret storage")).resolves.toBeVisible();
    });

    describe("when there is an error fetching the backup version", () => {
        filterConsole("Error fetching backup data from server");

        it("shows an error", async () => {
            vi.spyOn(mockClient.getCrypto()!, "getKeyBackupInfo").mockImplementation(async () => {
                throw new Error("bleh bleh");
            });

            const result = renderComponent();
            // We go though the dialog until we have to get the key backup
            await userEvent.click(result.getByRole("button", { name: "Continue" }));
            await userEvent.click(screen.getByRole("button", { name: "Copy" }));
            await userEvent.click(screen.getByRole("button", { name: "Continue" }));

            // XXX the error message is... misleading.
            await screen.findByText("Unable to query secret storage status");
            expect(result.container).toMatchSnapshot();

            // Now we can get the backup and we retry
            vi.spyOn(mockClient.getCrypto()!, "getKeyBackupInfo").mockRestore();
            await userEvent.click(screen.getByRole("button", { name: "Retry" }));
            await screen.findByText("Your keys are now being backed up from this device.");
        });
    });
});
