/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "test-utils-rtl";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { deriveRecoveryKeyFromPassphrase, encodeRecoveryKey } from "matrix-js-sdk/src/crypto-api";
import userEvent from "@testing-library/user-event";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import { CheckRecoveryKey } from "./CheckRecoveryKey";
import Modal from "../../../../Modal";
import ErrorDialog from "../../dialogs/ErrorDialog";

describe("<CheckRecoveryKey />", () => {
    const recoveryKey = encodeRecoveryKey(new Uint8Array(32))!;
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
        Object.assign(matrixClient.secretStorage, {
            getKey: vi.fn().mockResolvedValue(["keyId", {}]),
            checkKey: vi.fn().mockResolvedValue(true),
        });
    });

    function renderComponent(onFinish = vi.fn(), onCancelClick = vi.fn()) {
        return render(
            <CheckRecoveryKey onFinish={onFinish} onCancelClick={onCancelClick} />,
            withClientContextRenderOptions(matrixClient),
        );
    }

    it("should ask for the recovery key", () => {
        const { asFragment } = renderComponent();
        expect(screen.getByText("Check your recovery key")).toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should finish when the recovery key is correct", async () => {
        const onFinish = vi.fn();
        renderComponent(onFinish);

        await userEvent.type(screen.getByTitle("Enter recovery key"), recoveryKey);
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));

        await waitFor(() => expect(onFinish).toHaveBeenCalled());
        expect(matrixClient.secretStorage.checkKey).toHaveBeenCalled();
    });

    it("should show an error when the recovery key does not match", async () => {
        vi.mocked(matrixClient.secretStorage.checkKey).mockResolvedValue(false);
        const onFinish = vi.fn();
        renderComponent(onFinish);

        await userEvent.type(screen.getByTitle("Enter recovery key"), recoveryKey);
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));

        await expect(screen.findByText("Incorrect recovery key")).resolves.toBeInTheDocument();
        expect(onFinish).not.toHaveBeenCalled();
    });

    it("should show an error when the recovery key is malformed", async () => {
        const onFinish = vi.fn();
        renderComponent(onFinish);

        await userEvent.type(screen.getByTitle("Enter recovery key"), "not a recovery key");
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));

        await expect(screen.findByText("Incorrect recovery key")).resolves.toBeInTheDocument();
        expect(onFinish).not.toHaveBeenCalled();
    });

    it("should accept the passphrase if the key was set up with one", async () => {
        const passphrase = { algorithm: "m.pbkdf2", salt: "salt", iterations: 1, bits: 256 };
        vi.mocked(matrixClient.secretStorage.getKey).mockResolvedValue(["keyId", { passphrase }] as any);
        const onFinish = vi.fn();
        renderComponent(onFinish);

        await userEvent.type(screen.getByTitle("Enter recovery key"), "my passphrase");
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));

        await waitFor(() => expect(onFinish).toHaveBeenCalled());
        expect(matrixClient.secretStorage.checkKey).toHaveBeenCalledWith(
            await deriveRecoveryKeyFromPassphrase("my passphrase", "salt", 1),
            { passphrase },
        );
    });

    it("should show an error dialog if the key cannot be checked", async () => {
        vi.spyOn(console, "error").mockReturnValue(undefined);
        vi.mocked(matrixClient.secretStorage.getKey).mockRejectedValue(new Error("offline"));
        vi.spyOn(Modal, "createDialog");
        const onFinish = vi.fn();
        renderComponent(onFinish);

        await userEvent.type(screen.getByTitle("Enter recovery key"), recoveryKey);
        await userEvent.click(screen.getByRole("button", { name: "Continue" }));

        await waitFor(() =>
            expect(Modal.createDialog).toHaveBeenCalledWith(ErrorDialog, {
                title: "Failed to check the recovery key",
                description: "Error: offline",
            }),
        );
        await userEvent.click(screen.getByRole("button", { name: "OK" }));
        expect(onFinish).not.toHaveBeenCalled();
        // The key is not marked as incorrect and can be submitted again
        expect(screen.queryByText("Incorrect recovery key")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Continue" })).not.toHaveAttribute("aria-disabled", "true");
    });

    it("should go back", async () => {
        const onCancelClick = vi.fn();
        renderComponent(vi.fn(), onCancelClick);

        await userEvent.click(screen.getByRole("button", { name: "Go back" }));
        expect(onCancelClick).toHaveBeenCalled();
    });
});
