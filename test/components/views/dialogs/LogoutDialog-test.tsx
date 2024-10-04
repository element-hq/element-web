/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked, MockedObject } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { CryptoApi, KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { render, RenderResult } from "@testing-library/react";

import { filterConsole, getMockClientWithEventEmitter, mockClientMethodsCrypto } from "../../../test-utils";
import LogoutDialog from "../../../../src/components/views/dialogs/LogoutDialog";

describe("LogoutDialog", () => {
    let mockClient: MockedObject<MatrixClient>;
    let mockCrypto: MockedObject<CryptoApi>;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsCrypto(),
            getKeyBackupVersion: jest.fn(),
        });

        mockCrypto = mocked(mockClient.getCrypto()!);
        Object.assign(mockCrypto, {
            getActiveSessionBackupVersion: jest.fn().mockResolvedValue(null),
        });
    });

    function renderComponent(props: Partial<React.ComponentProps<typeof LogoutDialog>> = {}): RenderResult {
        const onFinished = jest.fn();
        return render(<LogoutDialog onFinished={onFinished} {...props} />);
    }

    it("shows a regular dialog when crypto is disabled", async () => {
        mocked(mockClient.getCrypto).mockReturnValue(undefined);
        const rendered = renderComponent();
        await rendered.findByText("Are you sure you want to sign out?");
        expect(rendered.container).toMatchSnapshot();
    });

    it("shows a regular dialog if backups are working", async () => {
        mockCrypto.getActiveSessionBackupVersion.mockResolvedValue("1");
        const rendered = renderComponent();
        await rendered.findByText("Are you sure you want to sign out?");
    });

    it("Prompts user to connect backup if there is a backup on the server", async () => {
        mockClient.getKeyBackupVersion.mockResolvedValue({} as KeyBackupInfo);
        const rendered = renderComponent();
        await rendered.findByText("Connect this session to Key Backup");
        expect(rendered.container).toMatchSnapshot();
    });

    it("Prompts user to set up backup if there is no backup on the server", async () => {
        mockClient.getKeyBackupVersion.mockResolvedValue(null);
        const rendered = renderComponent();
        await rendered.findByText("Start using Key Backup");
        expect(rendered.container).toMatchSnapshot();
    });

    describe("when there is an error fetching backups", () => {
        filterConsole("Unable to fetch key backup status");
        it("prompts user to set up backup", async () => {
            mockClient.getKeyBackupVersion.mockImplementation(async () => {
                throw new Error("beep");
            });
            const rendered = renderComponent();
            await rendered.findByText("Start using Key Backup");
        });
    });
});
