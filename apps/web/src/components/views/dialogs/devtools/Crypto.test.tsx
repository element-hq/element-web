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
import { type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { createTestClient, withClientContextRenderOptions } from "test-utils";

import { Crypto } from "./Crypto";

describe("<Crypto />", () => {
    let matrixClient: MatrixClient;
    beforeEach(() => {
        matrixClient = createTestClient();
    });

    function renderComponent() {
        return render(<Crypto onBack={vi.fn} />, withClientContextRenderOptions(matrixClient));
    }

    it("should display message if crypto is not available", async () => {
        vi.spyOn(matrixClient, "getCrypto").mockReturnValue(undefined);
        renderComponent();
        expect(screen.getByText("Cryptographic module is not available")).toBeInTheDocument();
    });

    describe("<KeyStorage />", () => {
        it("should display loading spinner while loading", async () => {
            vi.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockImplementation(() => new Promise(() => {}));
            renderComponent();
            await waitFor(() => expect(screen.getByLabelText("Loading…")).toBeInTheDocument());
        });

        it("should display when the key storage data are missing", async () => {
            renderComponent();
            await waitFor(() => expect(screen.getByRole("table", { name: "Key Storage" })).toBeInTheDocument());
            expect(screen.getByRole("table", { name: "Key Storage" })).toMatchSnapshot();
        });

        it("should display when the key storage data are available", async () => {
            vi.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue({
                algorithm: "m.megolm_backup.v1",
                version: "1",
            } as unknown as KeyBackupInfo);
            vi.spyOn(matrixClient, "isKeyBackupKeyStored").mockResolvedValue({});
            vi.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
            vi.spyOn(matrixClient.getCrypto()!, "getActiveSessionBackupVersion").mockResolvedValue("2");
            vi.spyOn(matrixClient.secretStorage, "hasKey").mockResolvedValue(true);
            vi.spyOn(matrixClient.getCrypto()!, "isSecretStorageReady").mockResolvedValue(true);

            renderComponent();
            await waitFor(() => expect(screen.getByRole("table", { name: "Key Storage" })).toBeInTheDocument());
            expect(screen.getByRole("table", { name: "Key Storage" })).toMatchSnapshot();
        });
    });

    describe("<CrossSigning />", () => {
        it("should display loading spinner while loading", async () => {
            vi.spyOn(matrixClient.getCrypto()!, "getCrossSigningStatus").mockImplementation(
                () => new Promise(() => {}),
            );
            renderComponent();
            await waitFor(() => expect(screen.getByLabelText("Loading…")).toBeInTheDocument());
        });

        it("should display when the cross-signing data are missing", async () => {
            renderComponent();
            await waitFor(() => expect(screen.getByRole("table", { name: "Cross-signing" })).toBeInTheDocument());
            expect(screen.getByRole("table", { name: "Cross-signing" })).toMatchSnapshot();
        });

        it("should display when the cross-signing data are available", async () => {
            vi.spyOn(matrixClient.getCrypto()!, "getCrossSigningStatus").mockResolvedValue({
                publicKeysOnDevice: true,
                privateKeysInSecretStorage: true,
                privateKeysCachedLocally: {
                    masterKey: true,
                    selfSigningKey: true,
                    userSigningKey: true,
                },
            });
            vi.spyOn(matrixClient.getCrypto()!, "isCrossSigningReady").mockResolvedValue(true);

            renderComponent();
            await waitFor(() => expect(screen.getByRole("table", { name: "Cross-signing" })).toBeInTheDocument());
            expect(screen.getByRole("table", { name: "Cross-signing" })).toMatchSnapshot();
        });
    });
});
