/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { logger } from "matrix-js-sdk/src/logger";
import fetchMockJest from "fetch-mock-jest";

import { advanceDateAndTime, stubClient } from "./test-utils";
import { IMatrixClientPeg, MatrixClientPeg as peg } from "../src/MatrixClientPeg";
import SettingsStore from "../src/settings/SettingsStore";
import { SettingLevel } from "../src/settings/SettingLevel";

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

            const mockInitCrypto = jest.spyOn(testPeg.safeGet(), "initCrypto").mockResolvedValue(undefined);
            const mockInitRustCrypto = jest.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);

            const cryptoStoreKey = new Uint8Array([1, 2, 3, 4]);
            await testPeg.start({ rustCryptoStoreKey: cryptoStoreKey });
            expect(mockInitCrypto).not.toHaveBeenCalled();
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
