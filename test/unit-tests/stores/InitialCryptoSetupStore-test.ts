/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "jest-matrix-react";

import { createCrossSigning } from "../../../src/CreateCrossSigning";
import { InitialCryptoSetupStore } from "../../../src/stores/InitialCryptoSetupStore";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { createTestClient } from "../../test-utils";
import { AccountPasswordStore } from "../../../src/stores/AccountPasswordStore";

jest.mock("../../../src/CreateCrossSigning", () => ({
    createCrossSigning: jest.fn(),
}));

describe("InitialCryptoSetupStore", () => {
    let testStore: InitialCryptoSetupStore;
    let client: MatrixClient;
    let stores: SdkContextClass;

    let createCrossSigningResolve: () => void;
    let createCrossSigningReject: (e: Error) => void;

    beforeEach(() => {
        testStore = new InitialCryptoSetupStore();
        client = createTestClient();
        stores = {
            accountPasswordStore: {
                getPassword: jest.fn(),
            } as unknown as AccountPasswordStore,
        } as unknown as SdkContextClass;

        mocked(createCrossSigning).mockImplementation(() => {
            return new Promise<void>((resolve, reject) => {
                createCrossSigningResolve = resolve;
                createCrossSigningReject = reject;
            });
        });
    });

    it("should call createCrossSigning when startInitialCryptoSetup is called", async () => {
        testStore.startInitialCryptoSetup(client, false, stores, jest.fn());

        await waitFor(() => expect(createCrossSigning).toHaveBeenCalled());
    });

    it("emits an update event when createCrossSigning resolves", async () => {
        const updateSpy = jest.fn();
        testStore.on("update", updateSpy);

        testStore.startInitialCryptoSetup(client, false, stores, jest.fn());
        createCrossSigningResolve();

        await waitFor(() => expect(updateSpy).toHaveBeenCalled());
        expect(testStore.getStatus()).toBe("complete");
    });

    it("emits an update event when createCrossSigning rejects", async () => {
        const updateSpy = jest.fn();
        testStore.on("update", updateSpy);

        testStore.startInitialCryptoSetup(client, false, stores, jest.fn());
        createCrossSigningReject(new Error("Test error"));

        await waitFor(() => expect(updateSpy).toHaveBeenCalled());
        expect(testStore.getStatus()).toBe("error");
    });

    it("should ignore failures if tokenLogin is true", async () => {
        const updateSpy = jest.fn();
        testStore.on("update", updateSpy);

        testStore.startInitialCryptoSetup(client, true, stores, jest.fn());
        createCrossSigningReject(new Error("Test error"));

        await waitFor(() => expect(updateSpy).toHaveBeenCalled());
        expect(testStore.getStatus()).toBe("complete");
    });
});
