/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked, type MockedObject } from "jest-mock-vitest-adapter";
import { Device, DeviceVerification, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi, DeviceVerificationStatus, type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { fireEvent, render, type RenderResult, screen, waitFor } from "jest-matrix-react";

import {
    filterConsole,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsUser,
} from "../../../../test-utils";
import LogoutDialog from "../../../../../src/components/views/dialogs/LogoutDialog";
import dispatch from "../../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../../src/dispatcher/actions";
import { UserTab } from "../../../../../src/components/views/dialogs/UserTab";

describe("LogoutDialog", () => {
    let mockClient: MockedObject<MatrixClient>;
    let mockCrypto: MockedObject<CryptoApi>;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsCrypto(),
            ...mockClientMethodsUser(),
            ...mockClientMethodsDevice(),
        });

        mockCrypto = mocked(mockClient.getCrypto()!);
        Object.assign(mockCrypto, {
            getUserDeviceInfo: jest.fn().mockResolvedValue(new Map()),
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
        await rendered.findByText("Are you sure you want to remove this device?");
        expect(rendered.container).toMatchSnapshot();
    });

    it("shows a regular dialog if backups and recovery are working", async () => {
        mockCrypto.getActiveSessionBackupVersion.mockResolvedValue("1");
        mockCrypto.isSecretStorageReady.mockResolvedValue(true);
        const rendered = renderComponent();
        await rendered.findByText("Are you sure you want to remove this device?");
    });

    it("shows a regular dialog if the user has another verified device", async () => {
        const userId = mockClient.getUserId()!;
        mockCrypto.getUserDeviceInfo.mockResolvedValue(
            new Map([
                [
                    userId,
                    new Map([
                        [
                            "otherDevice",
                            new Device({
                                deviceId: "otherDevice",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([["curve25519:otherDevice", "akey"]]),
                                verified: DeviceVerification.Verified,
                                dehydrated: false,
                            }),
                        ],
                    ]),
                ],
            ]),
        );
        mockCrypto.getDeviceVerificationStatus.mockResolvedValue(new DeviceVerificationStatus({ signedByOwner: true }));

        const rendered = renderComponent();
        await rendered.findByText("Are you sure you want to remove this device?");
    });

    it("prompts user to set up recovery if backups are enabled but recovery isn't", async () => {
        mockCrypto.getActiveSessionBackupVersion.mockResolvedValue("1");
        mockCrypto.isSecretStorageReady.mockResolvedValue(false);
        const rendered = renderComponent();
        await rendered.findByText("You're about to lose access to your encrypted chats");
    });

    it("Prompts user to set up recovery if there is a backup on the server but no secret storage", async () => {
        mockCrypto.getKeyBackupInfo.mockResolvedValue({} as KeyBackupInfo);
        const rendered = renderComponent();
        await rendered.findByText("Get recovery key");
        expect(rendered.container).toMatchSnapshot();

        jest.spyOn(dispatch, "dispatch");
        fireEvent.click(await screen.findByRole("button", { name: "Get recovery key" }));
        await waitFor(() =>
            expect(dispatch.dispatch).toHaveBeenCalledWith({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Encryption,
                props: {
                    initialEncryptionState: "set_recovery_key",
                },
            }),
        );
    });

    it("Prompts user to set up recovery if there is no backup on the server", async () => {
        mockCrypto.getKeyBackupInfo.mockResolvedValue(null);
        const rendered = renderComponent();
        await rendered.findByText("Get recovery key");
        expect(rendered.container).toMatchSnapshot();
    });

    it("Prompts user to set up recovery if there is no backup on the server, and the user has other unverified/dehydrated devices", async () => {
        const userId = mockClient.getUserId()!;
        const testDeviceId = mockClient.getDeviceId()!;
        mockCrypto.getUserDeviceInfo.mockResolvedValue(
            new Map([
                [
                    userId,
                    new Map([
                        // the current device
                        [
                            testDeviceId,
                            new Device({
                                deviceId: testDeviceId,
                                userId: userId,
                                algorithms: [],
                                keys: new Map([["curve25519:test-device-id", "akey"]]),
                                verified: DeviceVerification.Verified,
                                dehydrated: false,
                            }),
                        ],
                        // a dehydrated device
                        [
                            "dehydratedDevice",
                            new Device({
                                deviceId: "otherDevice",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([["curve25519:dehydratedDevice", "akey"]]),
                                verified: DeviceVerification.Verified,
                                dehydrated: true,
                            }),
                        ],
                        // an unverified device
                        [
                            "otherDevice",
                            new Device({
                                deviceId: "otherDevice",
                                userId: userId,
                                algorithms: [],
                                keys: new Map([["curve25519:otherDevice", "akey"]]),
                                verified: DeviceVerification.Unverified,
                                dehydrated: false,
                            }),
                        ],
                    ]),
                ],
            ]),
        );
        mockCrypto.getDeviceVerificationStatus.mockImplementation(async (_userId: string, deviceId: string) => {
            switch (deviceId) {
                case testDeviceId:
                case "dehydratedDevice":
                    return new DeviceVerificationStatus({ signedByOwner: true });
                case "otherDevice":
                    return new DeviceVerificationStatus({ signedByOwner: false });
                default:
                    throw new Error("Unknown device ID");
            }
        });

        mockCrypto.getKeyBackupInfo.mockResolvedValue(null);
        const rendered = renderComponent();
        await rendered.findByText("Get recovery key");
        expect(rendered.container).toMatchSnapshot();
    });

    describe("when there is an error fetching backups", () => {
        filterConsole("Unable to fetch key backup status");
        it("prompts user to go to settings", async () => {
            mockCrypto.getKeyBackupInfo.mockImplementation(async () => {
                throw new Error("beep");
            });
            const rendered = renderComponent();
            await rendered.findByText("Get recovery key");
        });
    });
});
