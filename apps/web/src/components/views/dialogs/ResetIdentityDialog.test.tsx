/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { act } from "react";
import { describe, it, expect, afterEach, vi, type MockedObject } from "vitest";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { render } from "test-utils-rtl";
import { getMockClientWithEventEmitter } from "test-utils";

import { ResetIdentityDialog } from "./ResetIdentityDialog";

describe("ResetIdentityDialog", () => {
    afterEach(() => {
        vi.resetAllMocks();
        vi.restoreAllMocks();
    });

    it("should call onReset and onFinished when we click Continue", async () => {
        const client = mockClient();

        const onFinished = vi.fn();
        const onReset = vi.fn();
        const dialog = render(<ResetIdentityDialog onFinished={onFinished} onReset={onReset} variant="compromised" />);

        await act(async () => dialog.getByRole("button", { name: "Continue" }).click());

        expect(onReset).toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalled();

        expect(client.getCrypto()?.resetEncryption).toHaveBeenCalled();
    });

    it("should call onFinished when we click Cancel", async () => {
        const client = mockClient();

        const onFinished = vi.fn();
        const onReset = vi.fn();
        const dialog = render(<ResetIdentityDialog onFinished={onFinished} onReset={onReset} variant="compromised" />);

        await act(async () => dialog.getByRole("button", { name: "Cancel" }).click());

        expect(onFinished).toHaveBeenCalled();

        expect(onReset).not.toHaveBeenCalled();
        expect(client.getCrypto()?.resetEncryption).not.toHaveBeenCalled();
    });
});

function mockClient(): MockedObject<MatrixClient> {
    const mockCrypto = {
        resetEncryption: vi.fn().mockResolvedValue(null),
    } as unknown as MockedObject<CryptoApi>;

    return getMockClientWithEventEmitter({
        getCrypto: vi.fn().mockReturnValue(mockCrypto),
    });
}
