/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "jest-matrix-react";
import { sleep } from "matrix-js-sdk/src/utils";

import { createCrossSigning } from "../../../src/CreateCrossSigning";
import { InitialCryptoSetupStore } from "../../../src/stores/InitialCryptoSetupStore";
import { createTestClient } from "../../test-utils";

jest.mock("../../../src/CreateCrossSigning", () => ({
    createCrossSigning: jest.fn(),
}));

describe("InitialCryptoSetupStore", () => {
    let testStore: InitialCryptoSetupStore;
    let client: MatrixClient;

    let createCrossSigningResolve: () => void;
    let createCrossSigningReject: (e: Error) => void;

    beforeEach(() => {
        testStore = new InitialCryptoSetupStore();
        client = createTestClient();

        mocked(createCrossSigning).mockImplementation(() => {
            return new Promise<void>((resolve, reject) => {
                createCrossSigningResolve = resolve;
                createCrossSigningReject = reject;
            });
        });
    });

    it("should call createCrossSigning when startInitialCryptoSetup is called", async () => {
        testStore.startInitialCryptoSetup(client, jest.fn());

        await waitFor(() => expect(createCrossSigning).toHaveBeenCalled());
    });

    it("emits an update event when createCrossSigning resolves", async () => {
        const updateSpy = jest.fn();
        testStore.on("update", updateSpy);

        testStore.startInitialCryptoSetup(client, jest.fn());
        createCrossSigningResolve();

        await waitFor(() => expect(updateSpy).toHaveBeenCalled());
        expect(testStore.getStatus()).toBe("complete");
    });

    it("emits an update event when createCrossSigning rejects", async () => {
        const updateSpy = jest.fn();
        testStore.on("update", updateSpy);

        testStore.startInitialCryptoSetup(client, jest.fn());
        createCrossSigningReject(new Error("Test error"));

        await waitFor(() => expect(updateSpy).toHaveBeenCalled());
        expect(testStore.getStatus()).toBe("error");
    });

    it("should fail to retry once complete", async () => {
        testStore.startInitialCryptoSetup(client, jest.fn());

        await waitFor(() => expect(createCrossSigning).toHaveBeenCalled());
        createCrossSigningResolve();
        await sleep(0); // await the next tick
        expect(testStore.retry()).toBeFalsy();
    });

    it("should retry if initial attempt failed", async () => {
        testStore.startInitialCryptoSetup(client, jest.fn());

        await waitFor(() => expect(createCrossSigning).toHaveBeenCalled());
        createCrossSigningReject(new Error("Test error"));
        await sleep(0); // await the next tick
        expect(testStore.retry()).toBeTruthy();
    });
});
