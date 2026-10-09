/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { Device, DeviceVerification, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { type CryptoApi, DeviceVerificationStatus, type KeyBackupInfo } from "matrix-js-sdk/src/crypto-api";
import { fireEvent, render, type RenderResult, screen } from "test-utils-rtl";
import { vi, describe, it, expect, beforeEach, type MockedObject } from "vitest";

import {
    filterConsole,
    getMockClientWithEventEmitter,
    mockClientMethodsCrypto,
    mockClientMethodsDevice,
    mockClientMethodsUser,
} from "test-utils";
import LogoutDialog from "./LogoutDialog";
import dispatch from "../../../dispatcher/dispatcher";

// Covered by its own tests; stub it so we only test how the dialog drives it
vi.mock("../settings/encryption/ChangeRecoveryKey", () => ({
    ChangeRecoveryKeyBody: (props: {
        userHasRecoveryKey: boolean;
        skipIntroduction?: boolean;
        onFinish: () => void;
        onCancelClick: () => void;
    }) => (
        <div>
            <span>{`ChangeRecoveryKeyBody userHasRecoveryKey=${props.userHasRecoveryKey} skipIntroduction=${props.skipIntroduction}`}</span>
            <button onClick={props.onFinish}>Stub finish</button>
            <button onClick={props.onCancelClick}>Stub cancel</button>
        </div>
    ),
}));
vi.mock("../settings/encryption/CheckRecoveryKey", () => ({
    CheckRecoveryKey: (props: { onFinish: () => void; onCancelClick: () => void }) => (
        <div>
            <span>CheckRecoveryKey</span>
            <button onClick={props.onFinish}>Stub key correct</button>
            <button onClick={props.onCancelClick}>Stub go back</button>
        </div>
    ),
}));

describe("LogoutDialog", () => {
    let mockClient: MockedObject<MatrixClient>;
    let mockCrypto: MockedObject<CryptoApi>;

    beforeEach(() => {
        mockClient = getMockClientWithEventEmitter({
            ...mockClientMethodsCrypto(),
            ...mockClientMethodsUser(),
            ...mockClientMethodsDevice(),
        });

        mockCrypto = vi.mocked(mockClient.getCrypto()!);
        Object.assign(mockCrypto, {
            getUserDeviceInfo: vi.fn().mockResolvedValue(new Map()),
            getActiveSessionBackupVersion: vi.fn().mockResolvedValue(null),
        });
    });

    function renderComponent(props: Partial<React.ComponentProps<typeof LogoutDialog>> = {}): RenderResult {
        const onFinished = vi.fn();
        return render(<LogoutDialog onFinished={onFinished} {...props} />);
    }

    it("shows a regular dialog when crypto is disabled", async () => {
        vi.mocked(mockClient.getCrypto).mockReturnValue(undefined);
        const rendered = renderComponent();
        await rendered.findByText("Are you sure you want to remove this device?");
        expect(rendered.container).toMatchSnapshot();
    });

    describe("when this is the only device and backups and recovery are working", () => {
        beforeEach(() => {
            mockCrypto.getActiveSessionBackupVersion.mockResolvedValue("1");
            mockCrypto.isSecretStorageReady.mockResolvedValue(true);
            vi.spyOn(dispatch, "dispatch").mockImplementation(() => {});
        });

        it("reminds the user to check their recovery key", async () => {
            const rendered = renderComponent();
            await rendered.findByText("Make sure you have access to your recovery key before removing this device");
            expect(rendered.container).toMatchSnapshot();
        });

        it("logs out on continue", async () => {
            const onFinished = vi.fn();
            renderComponent({ onFinished });
            fireEvent.click(await screen.findByRole("button", { name: "Continue to remove this device" }));
            expect(dispatch.dispatch).toHaveBeenCalledWith({ action: "logout" });
            expect(onFinished).toHaveBeenCalledWith(true);
        });
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
        await expect(
            rendered.findByText(
                "Make sure you always have access to another verified device or your recovery key to avoid losing your encrypted chat history.",
            ),
        ).resolves.toBeVisible();
    });

    it("prompts user to set up recovery if backups are enabled but recovery isn't", async () => {
        mockCrypto.getActiveSessionBackupVersion.mockResolvedValue("1");
        mockCrypto.isSecretStorageReady.mockResolvedValue(false);
        const rendered = renderComponent();
        await expect(rendered.findByText("You're about to lose access to your encrypted chats")).resolves.toBeVisible();
    });

    it("Prompts user to set up recovery if there is a backup on the server but no secret storage", async () => {
        mockCrypto.getKeyBackupInfo.mockResolvedValue({} as KeyBackupInfo);
        const rendered = renderComponent();
        await rendered.findByText("Get recovery key");
        expect(rendered.container).toMatchSnapshot();
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
            await expect(rendered.findByText("Get recovery key")).resolves.toBeVisible();
        });
    });

    describe("generating a recovery key inline", () => {
        const keyFlow = (userHasRecoveryKey: boolean): string =>
            `ChangeRecoveryKeyBody userHasRecoveryKey=${userHasRecoveryKey} skipIntroduction=true`;

        beforeEach(() => {
            vi.spyOn(dispatch, "dispatch").mockImplementation(() => {});
        });

        async function startFromRecoverySetUp(onFinished = vi.fn()): Promise<void> {
            mockCrypto.getActiveSessionBackupVersion.mockResolvedValue("1");
            mockCrypto.isSecretStorageReady.mockResolvedValue(true);
            renderComponent({ onFinished });
            fireEvent.click(await screen.findByRole("button", { name: "Generate new recovery key" }));
        }

        it("generates a key in the dialog when recovery is set up", async () => {
            await startFromRecoverySetUp();
            await expect(screen.findByText(keyFlow(true))).resolves.toBeVisible();
            expect(dispatch.dispatch).not.toHaveBeenCalled();
        });

        it("generates a key in the dialog when recovery is not set up", async () => {
            mockCrypto.getKeyBackupInfo.mockResolvedValue(null);
            renderComponent();
            fireEvent.click(await screen.findByRole("button", { name: "Get recovery key" }));
            await expect(screen.findByText(keyFlow(false))).resolves.toBeVisible();
            expect(dispatch.dispatch).not.toHaveBeenCalled();
        });

        it("returns to the warning on cancel", async () => {
            await startFromRecoverySetUp();
            fireEvent.click(await screen.findByRole("button", { name: "Stub cancel" }));
            await expect(
                screen.findByText("Make sure you have access to your recovery key before removing this device"),
            ).resolves.toBeVisible();
        });

        it("confirms the new key is active once finished", async () => {
            await startFromRecoverySetUp();
            fireEvent.click(await screen.findByRole("button", { name: "Stub finish" }));
            await expect(screen.findByText("Your new recovery key is now active")).resolves.toBeVisible();
            expect(document.body.querySelector(".mx_LogoutDialog")).toMatchSnapshot();
        });

        it("logs out after the new key is active", async () => {
            const onFinished = vi.fn();
            await startFromRecoverySetUp(onFinished);
            fireEvent.click(await screen.findByRole("button", { name: "Stub finish" }));
            fireEvent.click(await screen.findByRole("button", { name: "Continue to remove this device" }));
            expect(dispatch.dispatch).toHaveBeenCalledWith({ action: "logout" });
            expect(onFinished).toHaveBeenCalledWith(true);
        });

        it("goes back to the app after the new key is active", async () => {
            const onFinished = vi.fn();
            await startFromRecoverySetUp(onFinished);
            fireEvent.click(await screen.findByRole("button", { name: "Stub finish" }));
            fireEvent.click(await screen.findByRole("button", { name: "Take me back to the app" }));
            expect(dispatch.dispatch).not.toHaveBeenCalled();
            expect(onFinished).toHaveBeenCalledWith(false);
        });
    });

    describe("checking the recovery key inline", () => {
        beforeEach(async () => {
            mockCrypto.getActiveSessionBackupVersion.mockResolvedValue("1");
            mockCrypto.isSecretStorageReady.mockResolvedValue(true);
            vi.spyOn(dispatch, "dispatch").mockImplementation(() => {});
        });

        async function startCheck(onFinished = vi.fn()): Promise<void> {
            renderComponent({ onFinished });
            fireEvent.click(await screen.findByRole("button", { name: "Check your recovery key" }));
        }

        it("checks the key in the dialog", async () => {
            await startCheck();
            await expect(screen.findByText("CheckRecoveryKey")).resolves.toBeVisible();
            expect(dispatch.dispatch).not.toHaveBeenCalled();
        });

        it("returns to the warning on go back", async () => {
            await startCheck();
            fireEvent.click(await screen.findByRole("button", { name: "Stub go back" }));
            await expect(
                screen.findByText("Make sure you have access to your recovery key before removing this device"),
            ).resolves.toBeVisible();
        });

        it("confirms the key is active once checked", async () => {
            await startCheck();
            fireEvent.click(await screen.findByRole("button", { name: "Stub key correct" }));
            await expect(screen.findByText("Your recovery key is active")).resolves.toBeVisible();
        });

        it("logs out after the key is checked", async () => {
            const onFinished = vi.fn();
            await startCheck(onFinished);
            fireEvent.click(await screen.findByRole("button", { name: "Stub key correct" }));
            fireEvent.click(await screen.findByRole("button", { name: "Continue to remove this device" }));
            expect(dispatch.dispatch).toHaveBeenCalledWith({ action: "logout" });
            expect(onFinished).toHaveBeenCalledWith(true);
        });
    });
});
