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

import { render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { mocked, MockedObject } from "jest-mock";
import { CryptoApi, MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { defer, IDeferred, sleep } from "matrix-js-sdk/src/utils";
import { BackupTrustInfo, KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";

import {
    filterConsole,
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsServer,
} from "../../../../test-utils";
import CreateSecretStorageDialog from "../../../../../src/async-components/views/dialogs/security/CreateSecretStorageDialog";
import Modal from "../../../../../src/Modal";
import RestoreKeyBackupDialog from "../../../../../src/components/views/dialogs/security/RestoreKeyBackupDialog";

describe("CreateSecretStorageDialog", () => {
    let mockClient: MockedObject<MatrixClient>;
    let mockCrypto: MockedObject<CryptoApi>;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsServer(),
            ...mockClientMethodsCrypto(),
            uploadDeviceSigningKeys: jest.fn().mockImplementation(async () => {
                await sleep(0); // CreateSecretStorageDialog doesn't expect this to resolve immediately
                throw new MatrixError({ flows: [] });
            }),
        });

        mockCrypto = mocked(mockClient.getCrypto()!);
        Object.assign(mockCrypto, {
            isKeyBackupTrusted: jest.fn(),
            isDehydrationSupported: jest.fn(() => false),
            bootstrapCrossSigning: jest.fn(),
            bootstrapSecretStorage: jest.fn(),
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderComponent(
        props: Partial<React.ComponentProps<typeof CreateSecretStorageDialog>> = {},
    ): RenderResult {
        const onFinished = jest.fn();
        return render(<CreateSecretStorageDialog onFinished={onFinished} {...props} />);
    }

    it("shows a loading spinner initially", async () => {
        const { container } = renderComponent();
        expect(screen.getByTestId("spinner")).toBeDefined();
        expect(container).toMatchSnapshot();
        await flushPromises();
    });

    describe("when there is an error fetching the backup version", () => {
        filterConsole("Error fetching backup data from server");

        it("shows an error", async () => {
            mockClient.getKeyBackupVersion.mockImplementation(async () => {
                throw new Error("bleh bleh");
            });

            const result = renderComponent();
            // XXX the error message is... misleading.
            await result.findByText("Unable to query secret storage status");
            expect(result.container).toMatchSnapshot();
        });
    });

    it("shows 'Generate a Security Key' text if no key backup is present", async () => {
        const result = renderComponent();
        await flushPromises();
        expect(result.container).toMatchSnapshot();
        result.getByText("Generate a Security Key");
    });

    describe("when canUploadKeysWithPasswordOnly", () => {
        // spy on Modal.createDialog
        let modalSpy: jest.SpyInstance;

        // deferred which should be resolved to indicate that the created dialog has completed
        let restoreDialogFinishedDefer: IDeferred<[done?: boolean]>;

        beforeEach(() => {
            mockClient.getKeyBackupVersion.mockResolvedValue({} as KeyBackupInfo);
            mockClient.uploadDeviceSigningKeys.mockImplementation(async () => {
                await sleep(0);
                throw new MatrixError({
                    flows: [{ stages: ["m.login.password"] }],
                });
            });

            restoreDialogFinishedDefer = defer<[done?: boolean]>();
            modalSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: restoreDialogFinishedDefer.promise,
                close: jest.fn(),
            });
        });

        it("prompts for a password and then shows RestoreKeyBackupDialog", async () => {
            const result = renderComponent();
            await result.findByText(/Enter your account password to confirm the upgrade/);
            expect(result.container).toMatchSnapshot();

            await userEvent.type(result.getByPlaceholderText("Password"), "my pass");
            result.getByRole("button", { name: "Next" }).click();

            expect(modalSpy).toHaveBeenCalledWith(
                RestoreKeyBackupDialog,
                {
                    keyCallback: expect.any(Function),
                    showSummary: false,
                },
                undefined,
                false,
                false,
            );

            restoreDialogFinishedDefer.resolve([]);
        });

        it("calls bootstrapSecretStorage once keys are restored if the backup is now trusted", async () => {
            mockClient.isCryptoEnabled.mockReturnValue(true);

            const result = renderComponent();
            await result.findByText(/Enter your account password to confirm the upgrade/);
            expect(result.container).toMatchSnapshot();

            await userEvent.type(result.getByPlaceholderText("Password"), "my pass");
            result.getByRole("button", { name: "Next" }).click();

            expect(modalSpy).toHaveBeenCalled();

            // While we restore the key backup, its signature becomes accepted
            mockCrypto.isKeyBackupTrusted.mockResolvedValue({ trusted: true } as BackupTrustInfo);

            restoreDialogFinishedDefer.resolve([]);
            await flushPromises();

            // XXX no idea why this is a sensible thing to do. I just work here.
            expect(mockCrypto.bootstrapCrossSigning).toHaveBeenCalled();
            expect(mockCrypto.bootstrapSecretStorage).toHaveBeenCalled();

            await result.findByText("Your keys are now being backed up from this device.");
        });

        describe("when there is an error fetching the backup version after RestoreKeyBackupDialog", () => {
            filterConsole("Error fetching backup data from server");

            it("handles the error sensibly", async () => {
                const result = renderComponent();
                await result.findByText(/Enter your account password to confirm the upgrade/);
                expect(result.container).toMatchSnapshot();

                await userEvent.type(result.getByPlaceholderText("Password"), "my pass");
                result.getByRole("button", { name: "Next" }).click();

                expect(modalSpy).toHaveBeenCalled();

                mockClient.getKeyBackupVersion.mockImplementation(async () => {
                    throw new Error("bleh bleh");
                });
                restoreDialogFinishedDefer.resolve([]);
                await result.findByText("Unable to query secret storage status");
            });
        });
    });

    describe("when backup is present but not trusted", () => {
        beforeEach(() => {
            mockClient.getKeyBackupVersion.mockResolvedValue({} as KeyBackupInfo);
        });

        it("shows migrate text, then 'RestoreKeyBackupDialog' if 'Restore' is clicked", async () => {
            const result = renderComponent();
            await result.findByText("Restore your key backup to upgrade your encryption");
            expect(result.container).toMatchSnapshot();

            // before we click "Restore", set up a spy on createDialog
            const restoreDialogFinishedDefer = defer<[done?: boolean]>();
            const modalSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({
                finished: restoreDialogFinishedDefer.promise,
                close: jest.fn(),
            });

            result.getByRole("button", { name: "Restore" }).click();

            expect(modalSpy).toHaveBeenCalledWith(
                RestoreKeyBackupDialog,
                {
                    keyCallback: expect.any(Function),
                    showSummary: false,
                },
                undefined,
                false,
                false,
            );

            // simulate RestoreKeyBackupDialog completing, to run that code path
            restoreDialogFinishedDefer.resolve([]);
        });
    });
});
