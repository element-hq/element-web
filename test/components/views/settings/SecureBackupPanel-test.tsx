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
import { fireEvent, render, screen, within } from "@testing-library/react";
import { mocked } from "jest-mock";

import {
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsUser,
} from "../../../test-utils";
import SecureBackupPanel from "../../../../src/components/views/settings/SecureBackupPanel";
import { accessSecretStorage } from "../../../../src/SecurityManager";

jest.mock("../../../../src/SecurityManager", () => ({
    accessSecretStorage: jest.fn(),
}));

describe("<SecureBackupPanel />", () => {
    const userId = "@alice:server.org";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsCrypto(),
        getKeyBackupVersion: jest.fn().mockReturnValue("1"),
        getClientWellKnown: jest.fn(),
    });

    const getComponent = () => render(<SecureBackupPanel />);

    beforeEach(() => {
        client.getKeyBackupVersion.mockResolvedValue({
            version: "1",
            algorithm: "test",
            auth_data: {
                public_key: "1234",
            },
        });
        Object.assign(client.getCrypto()!, {
            isKeyBackupTrusted: jest.fn().mockResolvedValue({
                trusted: false,
                matchesDecryptionKey: false,
            }),
            getActiveSessionBackupVersion: jest.fn().mockResolvedValue(null),
            deleteKeyBackupVersion: jest.fn().mockResolvedValue(undefined),
        });

        mocked(client.secretStorage.hasKey).mockClear().mockResolvedValue(false);
        client.getKeyBackupVersion.mockClear();

        mocked(accessSecretStorage).mockClear().mockResolvedValue();
    });

    it("displays a loader while checking keybackup", async () => {
        getComponent();
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
        await flushPromises();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("handles error fetching backup", async () => {
        // getKeyBackupVersion can fail for various reasons
        client.getKeyBackupVersion.mockImplementation(async () => {
            throw new Error("beep beep");
        });
        const renderResult = getComponent();
        await renderResult.findByText("Unable to load key backup status");
        expect(renderResult.container).toMatchSnapshot();
    });

    it("handles absence of backup", async () => {
        client.getKeyBackupVersion.mockResolvedValue(null);
        getComponent();
        // flush getKeyBackupVersion promise
        await flushPromises();
        expect(screen.getByText("Back up your keys before signing out to avoid losing them.")).toBeInTheDocument();
    });

    it("suggests connecting session to key backup when backup exists", async () => {
        const { container } = getComponent();
        // flush checkKeyBackup promise
        await flushPromises();

        expect(container).toMatchSnapshot();
    });

    it("displays when session is connected to key backup", async () => {
        mocked(client.getCrypto()!).getActiveSessionBackupVersion.mockResolvedValue("1");
        getComponent();
        // flush checkKeyBackup promise
        await flushPromises();

        expect(screen.getByText("✅ This session is backing up your keys.")).toBeInTheDocument();
    });

    it("asks for confirmation before deleting a backup", async () => {
        getComponent();
        // flush checkKeyBackup promise
        await flushPromises();

        fireEvent.click(screen.getByText("Delete Backup"));

        const dialog = await screen.findByRole("dialog");

        expect(
            within(dialog).getByText(
                "Are you sure? You will lose your encrypted messages if your keys are not backed up properly.",
            ),
        ).toBeInTheDocument();

        fireEvent.click(within(dialog).getByText("Cancel"));

        expect(client.getCrypto()!.deleteKeyBackupVersion).not.toHaveBeenCalled();
    });

    it("deletes backup after confirmation", async () => {
        client.getKeyBackupVersion
            .mockResolvedValueOnce({
                version: "1",
                algorithm: "test",
                auth_data: {
                    public_key: "1234",
                },
            })
            .mockResolvedValue(null);
        getComponent();
        // flush checkKeyBackup promise
        await flushPromises();

        fireEvent.click(screen.getByText("Delete Backup"));

        const dialog = await screen.findByRole("dialog");

        expect(
            within(dialog).getByText(
                "Are you sure? You will lose your encrypted messages if your keys are not backed up properly.",
            ),
        ).toBeInTheDocument();

        fireEvent.click(within(dialog).getByTestId("dialog-primary-button"));

        expect(client.getCrypto()!.deleteKeyBackupVersion).toHaveBeenCalledWith("1");

        // delete request
        await flushPromises();
        // refresh backup info
        await flushPromises();
    });

    it("resets secret storage", async () => {
        mocked(client.secretStorage.hasKey).mockClear().mockResolvedValue(true);
        getComponent();
        // flush checkKeyBackup promise
        await flushPromises();

        client.getKeyBackupVersion.mockClear();
        mocked(client.getCrypto()!).isKeyBackupTrusted.mockClear();

        fireEvent.click(screen.getByText("Reset"));

        // enter loading state
        expect(accessSecretStorage).toHaveBeenCalled();
        await flushPromises();

        // backup status refreshed
        expect(client.getKeyBackupVersion).toHaveBeenCalled();
        expect(client.getCrypto()!.isKeyBackupTrusted).toHaveBeenCalled();
    });
});
