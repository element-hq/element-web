/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { act } from "react";
import { render } from "jest-matrix-react";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { type Mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { getMockClientWithEventEmitter } from "../../../../../test-utils";
import { ResetIdentityDialog } from "../../../../../../src/components/views/dialogs/ResetIdentityDialog";

describe("ResetIdentityDialog", () => {
    afterEach(() => {
        jest.resetAllMocks();
        jest.restoreAllMocks();
    });

    it("should call onReset and onFinished when we click Continue", async () => {
        const client = mockClient();

        const onFinished = jest.fn();
        const onReset = jest.fn();
        const dialog = render(<ResetIdentityDialog onFinished={onFinished} onReset={onReset} variant="compromised" />);

        await act(async () => dialog.getByRole("button", { name: "Continue" }).click());

        expect(onReset).toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalled();

        expect(client.getCrypto()?.resetEncryption).toHaveBeenCalled();
    });

    it("should call onFinished when we click Cancel", async () => {
        const client = mockClient();

        const onFinished = jest.fn();
        const onReset = jest.fn();
        const dialog = render(<ResetIdentityDialog onFinished={onFinished} onReset={onReset} variant="compromised" />);

        await act(async () => dialog.getByRole("button", { name: "Cancel" }).click());

        expect(onFinished).toHaveBeenCalled();

        expect(onReset).not.toHaveBeenCalled();
        expect(client.getCrypto()?.resetEncryption).not.toHaveBeenCalled();
    });
});

function mockClient(): Mocked<MatrixClient> {
    const mockCrypto = {
        resetEncryption: jest.fn().mockResolvedValue(null),
    } as unknown as Mocked<CryptoApi>;

    return getMockClientWithEventEmitter({
        getCrypto: jest.fn().mockReturnValue(mockCrypto),
    });
}
