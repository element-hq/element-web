/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import { render, screen } from "jest-matrix-react";
import { type Mocked } from "jest-mock";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

import SetupEncryptionDialog from "../../../../../../src/components/views/dialogs/security/SetupEncryptionDialog";
import { getMockClientWithEventEmitter } from "../../../../../test-utils";
import { Phase, SetupEncryptionStore } from "../../../../../../src/stores/SetupEncryptionStore";
import Modal from "../../../../../../src/Modal";

describe("SetupEncryptionDialog", () => {
    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it("should launch a dialog when I say Proceed, then be finished when I reset", async () => {
        mockClient();
        const store = new SetupEncryptionStore();
        jest.spyOn(SetupEncryptionStore, "sharedInstance").mockReturnValue(store);

        // Given when you open the reset dialog we immediately reset
        jest.spyOn(Modal, "createDialog").mockImplementation((_, props) => {
            // Simulate doing the reset in the dialog
            props?.onReset();

            return {
                close: jest.fn(),
                finished: Promise.resolve([]),
            };
        });

        // When we launch the dialog and set it ready to start
        const onFinished = jest.fn();
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
        getDeviceVerificationStatus: jest.fn().mockResolvedValue({
            crossSigningVerified: false,
        }),
        getUserDeviceInfo: jest.fn().mockResolvedValue(new Map()),
        isCrossSigningReady: jest.fn().mockResolvedValue(true),
        isSecretStorageReady: jest.fn().mockResolvedValue(true),
        userHasCrossSigningKeys: jest.fn(),
        getActiveSessionBackupVersion: jest.fn(),
        getCrossSigningStatus: jest.fn().mockReturnValue({
            publicKeysOnDevice: true,
            privateKeysInSecretStorage: true,
            privateKeysCachedLocally: {
                masterKey: true,
                selfSigningKey: true,
                userSigningKey: true,
            },
        }),
        getSessionBackupPrivateKey: jest.fn(),
        isEncryptionEnabledInRoom: jest.fn(),
        getKeyBackupInfo: jest.fn().mockResolvedValue(null),
        getVerificationRequestsToDeviceInProgress: jest.fn().mockReturnValue([]),
    } as unknown as Mocked<CryptoApi>;

    const userId = "@user:server";

    getMockClientWithEventEmitter({
        getCrypto: jest.fn().mockReturnValue(mockCrypto),
        getUserId: jest.fn().mockReturnValue(userId),
        secretStorage: { isStored: jest.fn().mockReturnValue({}) },
    });
}
