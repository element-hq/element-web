/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

import ImportE2eKeysDialog from "../../../../../../src/async-components/views/dialogs/security/ImportE2eKeysDialog";
import * as MegolmExportEncryption from "../../../../../../src/utils/MegolmExportEncryption";
import { createTestClient } from "../../../../../test-utils";

describe("ImportE2eKeysDialog", () => {
    it("renders", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const { asFragment } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should have disabled submit button initially", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const { container } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        expect(container.querySelector("[type=submit]")!).toBeDisabled();
    });

    it("should enable submit once file is uploaded and passphrase typed in", () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const file = new File(["test"], "file.txt", { type: "text/plain" });

        const { container } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        fireEvent.change(container.querySelector("[type=file]")!, {
            target: { files: [file] },
        });
        fireEvent.change(container.querySelector("[type=password]")!, {
            target: { value: "passphrase" },
        });
        expect(container.querySelector("[type=submit]")!).toBeEnabled();
    });

    it("should enable submit once file is uploaded and passphrase pasted in", async () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const file = new File(["test"], "file.txt", { type: "text/plain" });

        const { container } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        fireEvent.change(container.querySelector("[type=file]")!, {
            target: { files: [file] },
        });
        await userEvent.click(container.querySelector("[type=password]")!);
        await userEvent.paste("passphrase");
        expect(container.querySelector("[type=submit]")!).toBeEnabled();
    });

    it("should import exported keys on submit", async () => {
        const cli = createTestClient();
        const onFinished = jest.fn();
        const file = new File(["test"], "file.txt", { type: "text/plain" });
        const importRoomKeysAsJson = jest.fn();
        cli.getCrypto = () => {
            return {
                importRoomKeysAsJson,
            } as unknown as CryptoApi;
        };

        // Mock the result of decrypting the sessions, to avoid needing to
        // create encrypted input data.
        jest.spyOn(MegolmExportEncryption, "decryptMegolmKeyFile").mockResolvedValue("[]");

        const { container } = render(<ImportE2eKeysDialog matrixClient={cli} onFinished={onFinished} />);
        fireEvent.change(container.querySelector("[type=file]")!, {
            target: { files: [file] },
        });
        await userEvent.click(container.querySelector("[type=password]")!);
        await userEvent.paste("passphrase");
        fireEvent.click(container.querySelector("[type=submit]")!);

        await waitFor(() => expect(importRoomKeysAsJson).toHaveBeenCalled());
    });
});
