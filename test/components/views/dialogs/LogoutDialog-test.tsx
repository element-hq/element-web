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
