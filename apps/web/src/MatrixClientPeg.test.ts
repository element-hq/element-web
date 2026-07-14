/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { logger } from "matrix-js-sdk/src/logger";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";
import fetchMock from "@fetch-mock/vitest";
import { advanceDateAndTime, stubClient, createTestClient } from "test-utils";

import { type IMatrixClientPeg, MatrixClientPeg as peg } from "./MatrixClientPeg";
import SdkConfig from "./SdkConfig";

vi.useFakeTimers();

const PegClass = Object.getPrototypeOf(peg).constructor;

describe("MatrixClientPeg", () => {
    beforeEach(() => {
        // stub out Logger.log which gets called a lot and clutters up the test output
        vi.spyOn(logger, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();

        // some of the tests assign `MatrixClientPeg.matrixClient`: clear it, to prevent leakage between tests
        peg.unset();
    });

    it("setJustRegisteredUserId", () => {
        stubClient();
        (peg as any).matrixClient = peg.get();
        peg.setJustRegisteredUserId("@userId:matrix.org");
        expect(peg.safeGet().credentials.userId).toBe("@userId:matrix.org");
        expect(peg.currentUserIsJustRegistered()).toBe(true);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(true);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(true);
        advanceDateAndTime(1 * 60 * 60 * 1000 + 1);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(true);
        advanceDateAndTime(24 * 60 * 60 * 1000);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(false);
    });

    it("setJustRegisteredUserId(null)", () => {
        stubClient();
        (peg as any).matrixClient = peg.get();
        peg.setJustRegisteredUserId(null);
        expect(peg.currentUserIsJustRegistered()).toBe(false);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(false);
        advanceDateAndTime(1 * 60 * 60 * 1000 + 1);
        expect(peg.userRegisteredWithinLastHours(0)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(1)).toBe(false);
        expect(peg.userRegisteredWithinLastHours(24)).toBe(false);
    });

    describe(".start", () => {
        let testPeg: IMatrixClientPeg;

        beforeEach(() => {
            // instantiate a MatrixClientPegClass instance, with a new MatrixClient
            testPeg = new PegClass();
            fetchMock.get("http://example.com/_matrix/client/versions", {});

            const mockClient = createTestClient();
            mockClient.initRustCrypto = vi.fn();
            mockClient.startClient = vi.fn();
            testPeg.set(mockClient as unknown as MatrixClient);
        });

        it("should initialise the rust crypto library by default", async () => {
            const mockInitRustCrypto = vi.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);

            const cryptoStoreKey = new Uint8Array([1, 2, 3, 4]);
            await testPeg.start({ rustCryptoStoreKey: cryptoStoreKey });
            expect(mockInitRustCrypto).toHaveBeenCalledWith({ storageKey: cryptoStoreKey });
        });

        it("should try to start dehydration if dehydration is enabled", async () => {
            const mockInitRustCrypto = vi.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);
            const mockStartDehydration = vi.fn();
            vi.spyOn(testPeg.safeGet(), "getCrypto").mockReturnValue({
                isDehydrationSupported: vi.fn().mockResolvedValue(true),
                startDehydration: mockStartDehydration,
                setDeviceIsolationMode: vi.fn(),
            } as any);
            vi.spyOn(testPeg.safeGet(), "waitForClientWellKnown").mockResolvedValue({
                "m.homeserver": {
                    base_url: "http://example.com",
                },
                "org.matrix.msc3814": true,
            } as any);

            const cryptoStoreKey = new Uint8Array([1, 2, 3, 4]);
            await testPeg.start({ rustCryptoStoreKey: cryptoStoreKey });
            expect(mockInitRustCrypto).toHaveBeenCalledWith({ storageKey: cryptoStoreKey });
            expect(mockStartDehydration).toHaveBeenCalledWith({ onlyIfKeyCached: true, rehydrate: false });
        });

        it("Should migrate existing login", async () => {
            const mockInitRustCrypto = vi.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);

            await testPeg.start();
            expect(mockInitRustCrypto).toHaveBeenCalledTimes(1);
        });

        it("should poll the client well-known by default", async () => {
            vi.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);
            const startClient = vi.spyOn(testPeg.safeGet(), "startClient").mockResolvedValue(undefined);

            await testPeg.start();

            const opts = startClient.mock.calls[0][0];
            expect(opts?.clientWellKnownPollPeriod).toBe(2 * 60 * 60);
        });

        it("should not poll the client well-known when enable_client_well_known_lookups is false", async () => {
            const sdkConfigGet = SdkConfig.get;
            vi.spyOn(SdkConfig, "get").mockImplementation((key?: any, altCaseName?: string): any => {
                if (key === "enable_client_well_known_lookups") return false;
                return sdkConfigGet(key, altCaseName);
            });
            vi.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);
            const startClient = vi.spyOn(testPeg.safeGet(), "startClient").mockResolvedValue(undefined);

            await testPeg.start();

            const opts = startClient.mock.calls[0][0];
            expect(opts?.clientWellKnownPollPeriod).toBeUndefined();
        });
    });
});
