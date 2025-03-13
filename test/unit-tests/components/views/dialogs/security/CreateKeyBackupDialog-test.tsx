/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { render, screen, waitFor } from "jest-matrix-react";
import React from "react";
import { mocked } from "jest-mock";

import CreateKeyBackupDialog from "../../../../../../src/async-components/views/dialogs/security/CreateKeyBackupDialog";
import { createTestClient } from "../../../../../test-utils";
import { MatrixClientPeg } from "../../../../../../src/MatrixClientPeg";

jest.mock("../../../../../../src/SecurityManager", () => ({
    accessSecretStorage: jest.fn().mockResolvedValue(undefined),
    withSecretStorageKeyCache: jest.fn().mockImplementation((fn) => fn()),
}));

describe("CreateKeyBackupDialog", () => {
    beforeEach(() => {
        MatrixClientPeg.safeGet = MatrixClientPeg.get = () => createTestClient();
    });

    it("should display the spinner when creating backup", () => {
        const { asFragment } = render(<CreateKeyBackupDialog onFinished={jest.fn()} />);

        // Check if the spinner is displayed
        expect(screen.getByTestId("spinner")).toBeDefined();
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display an error message when backup creation failed", async () => {
        const matrixClient = createTestClient();
        jest.spyOn(matrixClient.secretStorage, "hasKey").mockResolvedValue(true);
        mocked(matrixClient.getCrypto()!.resetKeyBackup).mockImplementation(() => {
            throw new Error("failed");
        });
        MatrixClientPeg.safeGet = MatrixClientPeg.get = () => matrixClient;

        const { asFragment } = render(<CreateKeyBackupDialog onFinished={jest.fn()} />);

        // Check if the error message is displayed
        await waitFor(() => expect(screen.getByText("Unable to create key backup")).toBeDefined());
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display an error message when there is no Crypto available", async () => {
        const matrixClient = createTestClient();
        jest.spyOn(matrixClient.secretStorage, "hasKey").mockResolvedValue(true);
        mocked(matrixClient.getCrypto).mockReturnValue(undefined);
        MatrixClientPeg.safeGet = MatrixClientPeg.get = () => matrixClient;

        render(<CreateKeyBackupDialog onFinished={jest.fn()} />);

        // Check if the error message is displayed
        await waitFor(() => expect(screen.getByText("Unable to create key backup")).toBeDefined());
    });

    it("should display the success dialog when the key backup is finished", async () => {
        const onFinished = jest.fn();
        const { asFragment } = render(<CreateKeyBackupDialog onFinished={onFinished} />);

        await waitFor(() =>
            expect(
                screen.getByText("Your keys are being backed up (the first backup could take a few minutes)."),
            ).toBeDefined(),
        );
        expect(asFragment()).toMatchSnapshot();

        // Click on the OK button
        screen.getByRole("button", { name: "OK" }).click();
        expect(onFinished).toHaveBeenCalledWith(true);
    });
});
