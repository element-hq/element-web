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
import EventEmitter from "events";

import { advanceDateAndTime, stubClient } from "./test-utils";
import { IMatrixClientPeg, MatrixClientPeg as peg } from "../src/MatrixClientPeg";
import SettingsStore from "../src/settings/SettingsStore";
import Modal from "../src/Modal";
import PlatformPeg from "../src/PlatformPeg";
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

        it("should initialise client crypto", async () => {
            const mockInitCrypto = jest.spyOn(testPeg.safeGet(), "initCrypto").mockResolvedValue(undefined);
            const mockSetTrustCrossSignedDevices = jest
                .spyOn(testPeg.safeGet(), "setCryptoTrustCrossSignedDevices")
                .mockImplementation(() => {});
            const mockStartClient = jest.spyOn(testPeg.safeGet(), "startClient").mockResolvedValue(undefined);

            await testPeg.start();
            expect(mockInitCrypto).toHaveBeenCalledTimes(1);
            expect(mockSetTrustCrossSignedDevices).toHaveBeenCalledTimes(1);
            expect(mockStartClient).toHaveBeenCalledTimes(1);
        });

        it("should carry on regardless if there is an error initialising crypto", async () => {
            const e2eError = new Error("nope nope nope");
            const mockInitCrypto = jest.spyOn(testPeg.safeGet(), "initCrypto").mockRejectedValue(e2eError);
            const mockSetTrustCrossSignedDevices = jest
                .spyOn(testPeg.safeGet(), "setCryptoTrustCrossSignedDevices")
                .mockImplementation(() => {});
            const mockStartClient = jest.spyOn(testPeg.safeGet(), "startClient").mockResolvedValue(undefined);
            const mockWarning = jest.spyOn(logger, "warn").mockReturnValue(undefined);

            await testPeg.start();
            expect(mockInitCrypto).toHaveBeenCalledTimes(1);
            expect(mockSetTrustCrossSignedDevices).not.toHaveBeenCalled();
            expect(mockStartClient).toHaveBeenCalledTimes(1);
            expect(mockWarning).toHaveBeenCalledWith(expect.stringMatching("Unable to initialise e2e"), e2eError);
        });

        it("should initialise the rust crypto library, if enabled", async () => {
            const originalGetValue = SettingsStore.getValue;
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName: string, roomId: string | null = null, excludeDefault = false) => {
                    if (settingName === "feature_rust_crypto") {
                        return true;
                    }
                    return originalGetValue(settingName, roomId, excludeDefault);
                },
            );

            const mockSetValue = jest.spyOn(SettingsStore, "setValue").mockResolvedValue(undefined);

            const mockInitCrypto = jest.spyOn(testPeg.safeGet(), "initCrypto").mockResolvedValue(undefined);
            const mockInitRustCrypto = jest.spyOn(testPeg.safeGet(), "initRustCrypto").mockResolvedValue(undefined);

            await testPeg.start();
            expect(mockInitCrypto).not.toHaveBeenCalled();
            expect(mockInitRustCrypto).toHaveBeenCalledTimes(1);

            // we should have stashed the setting in the settings store
            expect(mockSetValue).toHaveBeenCalledWith("feature_rust_crypto", null, SettingLevel.DEVICE, true);
        });

        it("should reload when store database closes for a guest user", async () => {
            testPeg.safeGet().isGuest = () => true;
            const emitter = new EventEmitter();
            testPeg.safeGet().store.on = emitter.on.bind(emitter);
            const platform: any = { reload: jest.fn() };
            PlatformPeg.set(platform);
            await testPeg.assign();
            emitter.emit("closed" as any);
            expect(platform.reload).toHaveBeenCalled();
        });

        it("should show error modal when store database closes", async () => {
            testPeg.safeGet().isGuest = () => false;
            const emitter = new EventEmitter();
            testPeg.safeGet().store.on = emitter.on.bind(emitter);
            const spy = jest.spyOn(Modal, "createDialog");
            await testPeg.assign();
            emitter.emit("closed" as any);
            expect(spy).toHaveBeenCalled();
        });
    });
});
