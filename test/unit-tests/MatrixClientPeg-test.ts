/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import fetchMockJest from "fetch-mock-jest";

import { advanceDateAndTime, stubClient } from "../test-utils";
import { IMatrixClientPeg, MatrixClientPeg as peg } from "../../src/MatrixClientPeg";
import SettingsStore from "../../src/settings/SettingsStore";
import { SettingLevel } from "../../src/settings/SettingLevel";

jest.useFakeTimers();

const PegClass = Object.getPrototypeOf(peg).constructor;

describe("MatrixClientPeg", () => {
    beforeEach(() => {
        // stub out Logger.log which gets called a lot and clutters up the test output
        jest.spyOn(logger, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        localStorage.clear();
        jest.restoreAllMocks();

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
            fetchMockJest.get("http://example.com/_matrix/client/versions", {});
            testPeg.replaceUsingCreds({
                accessToken: "SEKRET",
                homeserverUrl: "http://example.com",
                userId: "@user:example.com",
                deviceId: "TEST_DEVICE_ID",
            });
        });

        it("should initialise the rust crypto library by default", async () => {
            const mockSetValue = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            const mockInitRustCrypto = jest.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);

            const cryptoStoreKey = new Uint8Array([1, 2, 3, 4]);
            await testPeg.start({ rustCryptoStoreKey: cryptoStoreKey });
            expect(mockInitRustCrypto).toHaveBeenCalledWith({ storageKey: cryptoStoreKey });

            // we should have stashed the setting in the settings store
            expect(mockSetValue).toHaveBeenCalledWith("feature_rust_crypto", null, SettingLevel.DEVICE, true);
        });

        it("Should migrate existing login", async () => {
            const mockSetValue = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);
            const mockInitRustCrypto = jest.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);

            await testPeg.start();
            expect(mockInitRustCrypto).toHaveBeenCalledTimes(1);

            // we should have stashed the setting in the settings store
            expect(mockSetValue).toHaveBeenCalledWith("feature_rust_crypto", null, SettingLevel.DEVICE, true);
        });
    });
});
