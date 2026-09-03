/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { act } from "react";
import { render, screen } from "test-utils-rtl";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { vi, describe, it, expect, afterEach, type Mocked } from "vitest";

import { getMockClientWithEventEmitter } from "test-utils";
import SetupEncryptionDialog from "./SetupEncryptionDialog";
import { Phase, SetupEncryptionStore } from "../../../../stores/SetupEncryptionStore";
import Modal from "../../../../Modal";

describe("SetupEncryptionDialog", () => {
    afterEach(() => {
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });

    it("should launch a dialog when I say Proceed, then be finished when I reset", async () => {
        mockClient();
        const store = new SetupEncryptionStore();
        vi.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);

        // Given when you open the reset dialog we immediately reset
        vi.spyOn(Modal, "createDialog").mockImplementation((_, props) => {
            // Simulate doing the reset in the dialog
            props?.onReset();

            return {
                close: vi.fn(),
                finished: Promise.resolve([]),
            };
        });

        // When we launch the dialog and set it ready to start
        const onFinished = vi.fn();
        render(<SetupEncryptionDialog onFinished={onFinished} />);
        await act(async () => await store.fetchKeyInfo());
        expect(store.phase).toBe(Phase.Intro);

        // And we hit the Proceed with reset button.
        // (The createDialog mock above simulates the user doing the reset)
        await act(async () => screen.getByRole("button", { name: "Can't confirm?" }).click());

        // Then the phase has been set to Finished
        expect(store.phase).toBe(Phase.Finished);
    });
});

function mockClient() {
    const mockCrypto = {
        getDeviceVerificationStatus: vi.fn().mockResolvedValue({
            crossSigningVerified: false,
        }),
        getUserDeviceInfo: vi.fn().mockResolvedValue(new Map()),
        isCrossSigningReady: vi.fn().mockResolvedValue(true),
        isSecretStorageReady: vi.fn().mockResolvedValue(true),
        userHasCrossSigningKeys: vi.fn(),
        getActiveSessionBackupVersion: vi.fn(),
        getCrossSigningStatus: vi.fn().mockReturnValue({
            publicKeysOnDevice: true,
            privateKeysInSecretStorage: true,
            privateKeysCachedLocally: {
                masterKey: true,
                selfSigningKey: true,
                userSigningKey: true,
            },
        }),
        getSessionBackupPrivateKey: vi.fn(),
        isEncryptionEnabledInRoom: vi.fn(),
        getKeyBackupInfo: vi.fn().mockResolvedValue(null),
        getVerificationRequestsToDeviceInProgress: vi.fn().mockReturnValue([]),
    } as unknown as Mocked<CryptoApi>;

    const userId = "@user:server";
    const deviceId = "ADEVICE";

    getMockClientWithEventEmitter({
        getCrypto: vi.fn().mockReturnValue(mockCrypto),
        getUserId: vi.fn().mockReturnValue(userId),
        getDeviceId: vi.fn().mockReturnValue(deviceId),
        secretStorage: { isStored: vi.fn().mockReturnValue({}) },
    });
}
