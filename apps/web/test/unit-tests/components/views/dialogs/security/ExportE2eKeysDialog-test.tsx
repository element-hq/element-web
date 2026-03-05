/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { screen, fireEvent, render, waitFor, act } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type IMegolmSessionData } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

import * as MegolmExportEncryption from "../../../../../../src/utils/MegolmExportEncryption";
import ExportE2eKeysDialog from "../../../../../../src/async-components/views/dialogs/security/ExportE2eKeysDialog";
import { createTestClient } from "../../../../../test-utils";

describe("ExportE2eKeysDialog", () => {
    it("renders", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const { asFragment } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should have disabled submit button initially", async () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const { container } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        await act(() => fireEvent.click(container.querySelector("[type=submit]")!));
        expect(screen.getByLabelText("Enter passphrase")).toBeInTheDocument();
    });

    it("should complain about weak passphrases", async () => {
        const cli = createTestClient();
        const onFinished = jest.fn();

        const { container } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        const input = screen.getByLabelText("Enter passphrase");
        await userEvent.type(input, "password");
        await act(() => fireEvent.click(container.querySelector("[type=submit]")!));
        await expect(screen.findByText("This is a top-10 common password")).resolves.toBeInTheDocument();
    });

    it("should complain if passphrases don't match", async () => {
        const cli = createTestClient();
        const onFinished = jest.fn();

        const { container } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        await userEvent.type(screen.getByLabelText("Enter passphrase"), "ThisIsAMoreSecurePW123$$");
        await userEvent.type(screen.getByLabelText("Confirm passphrase"), "ThisIsAMoreSecurePW124$$");
        await act(() => fireEvent.click(container.querySelector("[type=submit]")!));
        await expect(screen.findByText("Passphrases must match")).resolves.toBeInTheDocument();
    });

    it("should export if everything is fine", async () => {
        // Given a client able to export keys
        const cli = createTestClient();
        const keys: IMegolmSessionData[] = [];
        const passphrase = "ThisIsAMoreSecurePW123$$";
        const exportRoomKeysAsJson = jest.fn().mockResolvedValue(JSON.stringify(keys));
        cli.getCrypto = () => {
            return {
                exportRoomKeysAsJson,
            } as unknown as CryptoApi;
        };

        // Mock the result of encrypting the sessions. If we don't do this, the
        // encryption process fails, possibly because we didn't initialise
        // something.
        jest.spyOn(MegolmExportEncryption, "encryptMegolmKeyFile").mockResolvedValue(new ArrayBuffer(3));

        // When we tell the dialog to export
        const { container } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={jest.fn()} />);
        await userEvent.type(screen.getByLabelText("Enter passphrase"), passphrase);
        await userEvent.type(screen.getByLabelText("Confirm passphrase"), passphrase);
        await act(() => fireEvent.click(container.querySelector("[type=submit]")!));

        // Then it exports keys and encrypts them
        await waitFor(() => expect(exportRoomKeysAsJson).toHaveBeenCalled());
        await waitFor(() =>
            expect(MegolmExportEncryption.encryptMegolmKeyFile).toHaveBeenCalledWith(JSON.stringify(keys), passphrase),
        );
    });
});
