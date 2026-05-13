/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render, screen, waitFor, fireEvent, act } from "jest-matrix-react";
import { type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";

import { createTestClient, withClientContextRenderOptions } from "../../../../../test-utils";
import { KeyBackupDiagnosticsPanel } from "../../../../../../src/components/views/dialogs/devtools/KeyBackupDiagnosticsPanel";
import * as strings from "../../../../../../src/utils/strings";

/** A fully healthy backup info object for positive-path tests. */
const HEALTHY_BACKUP_INFO: KeyBackupInfo = {
    algorithm: "m.megolm_backup.v1.curve25519-aes-sha2",
    version: "3",
    auth_data: {
        public_key: "abc123publickey",
        signatures: {},
    },
};

/** A backup info that uses an unsupported algorithm. */
const UNSUPPORTED_BACKUP_INFO: KeyBackupInfo = {
    algorithm: "m.some.unknown.algorithm",
    version: "2",
    auth_data: { signatures: {} } as KeyBackupInfo["auth_data"],
};

describe("<KeyBackupDiagnosticsPanel />", () => {
    let matrixClient: MatrixClient;

    beforeEach(() => {
        matrixClient = createTestClient();
        // Spy on clipboard to avoid actual writes in tests
        jest.spyOn(strings, "copyPlaintext").mockResolvedValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderComponent(): ReturnType<typeof render> {
        return render(<KeyBackupDiagnosticsPanel />, withClientContextRenderOptions(matrixClient));
    }

    it("should render a loading spinner while computing diagnostics", () => {
        // Make getKeyBackupInfo never resolve so the component stays in loading state
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockImplementation(() => new Promise(() => {}));

        renderComponent();

        expect(screen.getByLabelText("Key Backup Diagnostics")).toBeInTheDocument();
    });

    it("should render the 'crypto not available' message when getCrypto() returns undefined", async () => {
        jest.spyOn(matrixClient, "getCrypto").mockReturnValue(undefined);

        renderComponent();

        await waitFor(() =>
            expect(screen.getByText("Cryptographic module is not available")).toBeInTheDocument(),
        );
    });

    it("should render an OK status banner when all checks pass", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: true,
            matchesDecryptionKey: true,
        });

        renderComponent();

        await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
        expect(screen.getByRole("status")).toHaveTextContent("OK");
    });

    it("should render a Warning status banner when local key is missing", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(null);

        renderComponent();

        await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
        expect(screen.getByRole("status")).toHaveTextContent("Warning");
    });

    it("should render an Error status banner when keys mismatch (critical case)", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: false,
            matchesDecryptionKey: false,
        });

        renderComponent();

        await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
        expect(screen.getByRole("status")).toHaveTextContent("Error");
    });

    it("should render a Warning status banner when no server backup exists", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(null);

        renderComponent();

        await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
        expect(screen.getByRole("status")).toHaveTextContent("Warning");
    });

    it("should render the server backup section table", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: true,
            matchesDecryptionKey: true,
        });

        renderComponent();

        await waitFor(() =>
            expect(screen.getByRole("table", { name: "Server Backup" })).toBeInTheDocument(),
        );
        // Version should be visible
        expect(screen.getByRole("table", { name: "Server Backup" })).toHaveTextContent("3");
        // Algorithm should be visible
        expect(screen.getByRole("table", { name: "Server Backup" })).toHaveTextContent(
            "m.megolm_backup.v1.curve25519-aes-sha2",
        );
    });

    it("should render the local backup section table", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: true,
            matchesDecryptionKey: true,
        });

        renderComponent();

        await waitFor(() =>
            expect(screen.getByRole("table", { name: "Local Backup" })).toBeInTheDocument(),
        );
        expect(screen.getByRole("table", { name: "Local Backup" })).toHaveTextContent("Available");
    });

    it("should render the consistency checks table with all check rows", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: true,
            matchesDecryptionKey: true,
        });

        renderComponent();

        await waitFor(() =>
            expect(screen.getByRole("table", { name: "Consistency Checks" })).toBeInTheDocument(),
        );
        const table = screen.getByRole("table", { name: "Consistency Checks" });
        // All five checks should appear for a full healthy backup
        expect(table).toHaveTextContent("Server backup exists");
        expect(table).toHaveTextContent("Backup algorithm supported");
        expect(table).toHaveTextContent("Server public key present");
        expect(table).toHaveTextContent("Local backup private key available");
        expect(table).toHaveTextContent("Local key matches server key");
    });

    it("should call copyPlaintext with sanitized summary when copy button is clicked", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: true,
            matchesDecryptionKey: true,
        });

        renderComponent();

        await waitFor(() => expect(screen.getByRole("button", { name: "Copy diagnostic summary" })).toBeInTheDocument());

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Copy diagnostic summary" }));
        });

        expect(strings.copyPlaintext).toHaveBeenCalledTimes(1);
        const copiedText = (strings.copyPlaintext as jest.Mock).mock.calls[0][0] as string;
        // Verify the copied text is the sanitized summary, not raw private key data
        expect(copiedText).toContain("Key Backup Diagnostics");
        expect(copiedText).toContain("Version: 3");
        // Ensure private key bytes are NOT in the copied text
        expect(copiedText).not.toContain("0,0,0,0");
    });

    it("should show copy success message after a successful copy", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: true,
            matchesDecryptionKey: true,
        });

        renderComponent();

        await waitFor(() => expect(screen.getByRole("button", { name: "Copy diagnostic summary" })).toBeInTheDocument());

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Copy diagnostic summary" }));
        });

        await waitFor(() =>
            expect(screen.getByText("Diagnostic summary copied")).toBeInTheDocument(),
        );
    });

    it("should re-run diagnostics when the Refresh button is clicked", async () => {
        const getKeyBackupInfoSpy = jest
            .spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo")
            .mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: true,
            matchesDecryptionKey: true,
        });

        renderComponent();

        await waitFor(() => expect(screen.getByRole("button", { name: "Refresh diagnostics" })).toBeInTheDocument());

        const callCountBefore = getKeyBackupInfoSpy.mock.calls.length;

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Refresh diagnostics" }));
        });

        // getKeyBackupInfo should be called again after refresh
        await waitFor(() =>
            expect(getKeyBackupInfoSpy.mock.calls.length).toBeGreaterThan(callCountBefore),
        );
    });

    it("should NOT expose any private key material in the rendered DOM", async () => {
        // Use a recognisable private key pattern that should never appear in UI
        const MOCK_PRIVATE_KEY = new Uint8Array(32).fill(0xab);
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(MOCK_PRIVATE_KEY);
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: false,
            matchesDecryptionKey: false,
        });

        const { container } = renderComponent();

        await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

        // The raw private key bytes must not appear anywhere in the DOM text
        const domText = container.textContent ?? "";
        expect(domText).not.toContain("171"); // 0xab = 171 decimal
        expect(domText).not.toContain("0xab");
        expect(domText).not.toContain("access_token");
    });

    it("should render the unsupported algorithm warning in the checks table", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(UNSUPPORTED_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));

        renderComponent();

        await waitFor(() =>
            expect(screen.getByRole("table", { name: "Consistency Checks" })).toBeInTheDocument(),
        );
        const table = screen.getByRole("table", { name: "Consistency Checks" });
        expect(table).toHaveTextContent("Backup algorithm supported");
        // The warning severity label should appear for the unsupported algorithm
        expect(table).toHaveTextContent("Warning");
    });

    it("should match snapshot for the complete panel in healthy state", async () => {
        jest.spyOn(matrixClient.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(HEALTHY_BACKUP_INFO);
        jest.spyOn(matrixClient.getCrypto()!, "getSessionBackupPrivateKey").mockResolvedValue(new Uint8Array(32));
        jest.spyOn(matrixClient.getCrypto()!, "isKeyBackupTrusted").mockResolvedValue({
            trusted: true,
            matchesDecryptionKey: true,
        });

        const { container } = renderComponent();

        await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());

        expect(container).toMatchSnapshot();
    });
});
