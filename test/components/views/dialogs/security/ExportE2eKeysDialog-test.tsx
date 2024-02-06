/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { screen, fireEvent, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CryptoApi, IMegolmSessionData } from "matrix-js-sdk/src/matrix";

import * as MegolmExportEncryption from "../../../../../src/utils/MegolmExportEncryption";
import ExportE2eKeysDialog from "../../../../../src/async-components/views/dialogs/security/ExportE2eKeysDialog";
import { createTestClient } from "../../../../test-utils";

describe("ExportE2eKeysDialog", () => {
    it("renders", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const { asFragment } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should have disabled submit button initially", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const { container } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        fireEvent.click(container.querySelector("[type=submit]")!);
        expect(screen.getByText("Enter passphrase")).toBeInTheDocument();
    });

    it("should complain about weak passphrases", async () => {
        const cli = createTestClient();
        const onFinished = jest.fn();

        const { container } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        const input = screen.getByLabelText("Enter passphrase");
        await userEvent.type(input, "password");
        fireEvent.click(container.querySelector("[type=submit]")!);
        await expect(screen.findByText("This is a top-10 common password")).resolves.toBeInTheDocument();
    });

    it("should complain if passphrases don't match", async () => {
        const cli = createTestClient();
        const onFinished = jest.fn();

        const { container } = render(<ExportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        await userEvent.type(screen.getByLabelText("Enter passphrase"), "ThisIsAMoreSecurePW123$$");
        await userEvent.type(screen.getByLabelText("Confirm passphrase"), "ThisIsAMoreSecurePW124$$");
        fireEvent.click(container.querySelector("[type=submit]")!);
        await expect(screen.findByText("Passphrases must match")).resolves.toBeInTheDocument();
    });

    it("should export if everything is fine", async () => {
        // Given a client able to export keys
        const cli = createTestClient();
        const keys: IMegolmSessionData[] = [];
        const passphrase = "ThisIsAMoreSecurePW123$$";
        const exportRoomKeys = jest.fn().mockResolvedValue(keys);
        cli.getCrypto = () => {
            return {
                exportRoomKeys,
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
        fireEvent.click(container.querySelector("[type=submit]")!);

        // Then it exports keys and encrypts them
        await waitFor(() => expect(exportRoomKeys).toHaveBeenCalled());
        await waitFor(() =>
            expect(MegolmExportEncryption.encryptMegolmKeyFile).toHaveBeenCalledWith(JSON.stringify(keys), passphrase),
        );
    });
});
