/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import { waitFor } from "test-utils-rtl";
import { sleep } from "matrix-js-sdk/src/utils";
import { createTestClient } from "test-utils";

import { createCrossSigning } from "../CreateCrossSigning";
import { setUpRecoverySilently } from "../utils/crypto/silentRecoverySetup";
import { InitialCryptoSetupStore } from "./InitialCryptoSetupStore";

vi.mock("../CreateCrossSigning", () => ({
    createCrossSigning: vi.fn(),
}));
vi.mock("../utils/crypto/silentRecoverySetup", () => ({
    setUpRecoverySilently: vi.fn(),
}));

describe("InitialCryptoSetupStore", () => {
    let testStore: InitialCryptoSetupStore;
    let client: MatrixClient;

    let createCrossSigningResolve: () => void;
    let createCrossSigningReject: (e: Error) => void;

    beforeEach(() => {
        testStore = new InitialCryptoSetupStore();
        client = createTestClient();

        vi.mocked(createCrossSigning).mockImplementation(() => {
            return new Promise<void>((resolve, reject) => {
                createCrossSigningResolve = resolve;
                createCrossSigningReject = reject;
            });
        });
        vi.mocked(setUpRecoverySilently).mockReset().mockResolvedValue(false);
    });

    it("should call createCrossSigning when startInitialCryptoSetup is called", async () => {
        testStore.startInitialCryptoSetup(client, vi.fn());

        await waitFor(() => expect(createCrossSigning).toHaveBeenCalled());
    });

    it("emits an update event when createCrossSigning resolves", async () => {
        const updateSpy = vi.fn();
        testStore.on("update", updateSpy);

        testStore.startInitialCryptoSetup(client, vi.fn());
        createCrossSigningResolve();

        await waitFor(() => expect(updateSpy).toHaveBeenCalled());
        expect(testStore.getStatus()).toBe("complete");
    });

    it("emits an update event when createCrossSigning rejects", async () => {
        const updateSpy = vi.fn();
        testStore.on("update", updateSpy);

        testStore.startInitialCryptoSetup(client, vi.fn());
        createCrossSigningReject(new Error("Test error"));

        await waitFor(() => expect(updateSpy).toHaveBeenCalled());
        expect(testStore.getStatus()).toBe("error");
    });

    it("should fail to retry once complete", async () => {
        testStore.startInitialCryptoSetup(client, vi.fn());

        await waitFor(() => expect(createCrossSigning).toHaveBeenCalled());
        createCrossSigningResolve();
        await sleep(0); // await the next tick
        expect(testStore.retry()).toBeFalsy();
    });

    it("sets up recovery silently once the identity exists, before reporting success", async () => {
        const steps: string[] = [];
        vi.mocked(client.getCrypto()!.checkKeyBackupAndEnable).mockImplementation(async () => {
            steps.push("backup");
            return null;
        });
        vi.mocked(setUpRecoverySilently).mockImplementation(async () => {
            steps.push("recovery");
            return true;
        });
        const onFinished = vi.fn(() => steps.push("finished"));

        testStore.startInitialCryptoSetup(client, onFinished);
        createCrossSigningResolve();

        await waitFor(() => expect(onFinished).toHaveBeenCalledWith(true));
        expect(setUpRecoverySilently).toHaveBeenCalledWith(client);
        expect(steps).toEqual(["backup", "recovery", "finished"]);
        expect(testStore.getStatus()).toBe("complete");
    });

    it("does not set up recovery when creating the identity fails", async () => {
        testStore.startInitialCryptoSetup(client, vi.fn());
        createCrossSigningReject(new Error("Test error"));

        await waitFor(() => expect(testStore.getStatus()).toBe("error"));
        expect(setUpRecoverySilently).not.toHaveBeenCalled();
    });

    it("should retry if initial attempt failed", async () => {
        testStore.startInitialCryptoSetup(client, vi.fn());

        await waitFor(() => expect(createCrossSigning).toHaveBeenCalled());
        createCrossSigningReject(new Error("Test error"));
        await sleep(0); // await the next tick
        expect(testStore.retry()).toBeTruthy();
    });
});
