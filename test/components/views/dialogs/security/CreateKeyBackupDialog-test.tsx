/*
 * Copyright 2023 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mocked } from "jest-mock";

import CreateKeyBackupDialog from "../../../../../src/async-components/views/dialogs/security/CreateKeyBackupDialog";
import { createTestClient, filterConsole } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";

jest.mock("../../../../../src/SecurityManager", () => ({
    accessSecretStorage: async (func = async () => Promise<void>) => {
        await func();
    },
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

    describe("expecting failure", () => {
        filterConsole("Error creating key backup");

        it("should display an error message when backup creation failed", async () => {
            const matrixClient = createTestClient();
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
            mocked(matrixClient.getCrypto).mockReturnValue(undefined);
            MatrixClientPeg.safeGet = MatrixClientPeg.get = () => matrixClient;

            render(<CreateKeyBackupDialog onFinished={jest.fn()} />);

            // Check if the error message is displayed
            await waitFor(() => expect(screen.getByText("Unable to create key backup")).toBeDefined());
        });
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
