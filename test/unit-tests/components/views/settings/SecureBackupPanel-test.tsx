/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { fireEvent, render, screen, within } from "jest-matrix-react";
import { mocked } from "jest-mock";

import {
    flushPromises,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsUser,
} from "../../../../test-utils";
import SecureBackupPanel from "../../../../../src/components/views/settings/SecureBackupPanel";
import { accessSecretStorage } from "../../../../../src/SecurityManager";

jest.mock("../../../../../src/SecurityManager", () => ({
    accessSecretStorage: jest.fn(),
}));

describe("<SecureBackupPanel />", () => {
    const userId = "@alice:server.org";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(userId),
        ...mockClientMethodsCrypto(),
        getClientWellKnown: jest.fn(),
    });

    const getComponent = () => render(<SecureBackupPanel />);

    beforeEach(() => {
        jest.spyOn(client.getCrypto()!, "getKeyBackupInfo").mockResolvedValue({
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

        mocked(accessSecretStorage).mockClear().mockResolvedValue();
    });

    it("displays a loader while checking keybackup", async () => {
        getComponent();
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
        await flushPromises();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it("handles error fetching backup", async () => {
        // getKeyBackupInfo can fail for various reasons
        jest.spyOn(client.getCrypto()!, "getKeyBackupInfo").mockImplementation(async () => {
            throw new Error("beep beep");
        });
        const renderResult = getComponent();
        await renderResult.findByText("Unable to load key backup status");
        expect(renderResult.container).toMatchSnapshot();
    });

    it("handles absence of backup", async () => {
        jest.spyOn(client.getCrypto()!, "getKeyBackupInfo").mockResolvedValue(null);
        getComponent();
        // flush getKeyBackupInfo promise
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
        jest.spyOn(client.getCrypto()!, "getKeyBackupInfo")
            .mockResolvedValueOnce({
                version: "1",
                algorithm: "test",
                auth_data: {
                    public_key: "1234",
                },
            })
            .mockResolvedValue(null);
        getComponent();

        fireEvent.click(await screen.findByText("Delete Backup"));

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

        jest.spyOn(client.getCrypto()!, "getKeyBackupInfo").mockClear();
        mocked(client.getCrypto()!).isKeyBackupTrusted.mockClear();

        fireEvent.click(screen.getByText("Reset"));

        // enter loading state
        expect(accessSecretStorage).toHaveBeenCalled();
        await flushPromises();

        // backup status refreshed
        expect(client.getCrypto()!.getKeyBackupInfo).toHaveBeenCalled();
        expect(client.getCrypto()!.isKeyBackupTrusted).toHaveBeenCalled();
    });
});
