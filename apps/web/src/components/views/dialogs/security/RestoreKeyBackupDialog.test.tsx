/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { screen, render, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
// Needed to be able to mock decodeRecoveryKey
// eslint-disable-next-line no-restricted-imports
import * as recoveryKeyModule from "matrix-js-sdk/src/crypto-api/recovery-key";
import { describe, it, test, expect, vi, beforeEach } from "vitest";

import { stubClient } from "test-utils";
import RestoreKeyBackupDialog from "./RestoreKeyBackupDialog";

vi.mock("react-focus-lock");

describe("<RestoreKeyBackupDialog />", () => {
    const keyBackupRestoreResult = {
        total: 2,
        imported: 1,
    };

    let matrixClient: MatrixClient;
    beforeEach(() => {
        matrixClient = stubClient();
        vi.spyOn(recoveryKeyModule, "decodeRecoveryKey").mockReturnValue(new Uint8Array(32));
        vi.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue({ version: "1" } as KeyBackupInfo);
    });

    it("should render", async () => {
        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={vi.fn()} />);
        await waitFor(() => expect(screen.getByText("Enter Recovery Key")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display an error when recovery key is invalid", async () => {
        vi.spyOn(recoveryKeyModule, "decodeRecoveryKey").mockImplementation(() => {
            throw new Error("Invalid recovery key");
        });
        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={vi.fn()} />);
        await waitFor(() => expect(screen.getByText("Enter Recovery Key")).toBeInTheDocument());

        await userEvent.type(screen.getByRole("textbox"), "invalid key");
        await waitFor(() => expect(screen.getByText("👎 Not a valid Recovery Key")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should not raise an error when recovery is valid", async () => {
        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={vi.fn()} />);
        await waitFor(() => expect(screen.getByText("Enter Recovery Key")).toBeInTheDocument());

        await userEvent.type(screen.getByRole("textbox"), "valid key");
        await waitFor(() => expect(screen.getByText("👍 This looks like a valid Recovery Key!")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should restore key backup when the key is cached", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "restoreKeyBackup").mockResolvedValue(keyBackupRestoreResult);

        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={vi.fn()} />);
        await waitFor(() => expect(screen.getByText("Successfully restored 1 keys")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should restore key backup when the key is in secret storage", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "restoreKeyBackup")
            // Reject when trying to restore from cache
            .mockRejectedValueOnce(new Error("key backup not found"))
            // Resolve when trying to restore from secret storage
            .mockResolvedValue(keyBackupRestoreResult);
        vi.spyOn(matrixClient.secretStorage, "hasKey").mockResolvedValue(true);
        vi.spyOn(matrixClient, "isKeyBackupKeyStored").mockResolvedValue({});

        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={vi.fn()} />);
        await waitFor(() => expect(screen.getByText("Successfully restored 1 keys")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should restore key backup when Recovery key is filled by user", async () => {
        vi.spyOn(matrixClient.getCrypto()!, "restoreKeyBackup")
            // Reject when trying to restore from cache
            .mockRejectedValueOnce(new Error("key backup not found"))
            // Resolve when trying to restore from recovery key
            .mockResolvedValue(keyBackupRestoreResult);

        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={vi.fn()} />);
        await waitFor(() => expect(screen.getByText("Enter Recovery Key")).toBeInTheDocument());

        await userEvent.type(screen.getByRole("textbox"), "my recovery key");
        await userEvent.click(screen.getByRole("button", { name: "Next" }));

        await waitFor(() => expect(screen.getByText("Successfully restored 1 keys")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });

    test("should restore key backup when passphrase is filled", async () => {
        // Determine that the passphrase is required
        vi.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue({
            version: "1",
            auth_data: {
                private_key_salt: "salt",
                private_key_iterations: 1,
            },
        } as KeyBackupInfo);

        vi.spyOn(matrixClient.getCrypto()!, "restoreKeyBackup")
            // Reject when trying to restore from cache
            .mockRejectedValue(new Error("key backup not found"));

        vi.spyOn(matrixClient.getCrypto()!, "restoreKeyBackupWithPassphrase").mockResolvedValue(keyBackupRestoreResult);

        const { asFragment } = render(<RestoreKeyBackupDialog onFinished={vi.fn()} />);
        await waitFor(() => expect(screen.getByText("Enter Security Phrase")).toBeInTheDocument());
        // Not role for password https://github.com/w3c/aria/issues/935
        await userEvent.type(screen.getByTestId("passphraseInput"), "my passphrase");
        await userEvent.click(screen.getByRole("button", { name: "Next" }));

        await waitFor(() => expect(screen.getByText("Successfully restored 1 keys")).toBeInTheDocument());
        expect(asFragment()).toMatchSnapshot();
    });
});
