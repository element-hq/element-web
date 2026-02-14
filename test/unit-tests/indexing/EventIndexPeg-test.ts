/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Mocked } from "jest-mock";

import { EventIndexPeg } from "../../../src/indexing/EventIndexPeg";
import { mockPlatformPeg } from "../../test-utils";
import type BaseEventIndexManager from "../../../src/indexing/BaseEventIndexManager";
import SettingsStore from "../../../src/settings/SettingsStore";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import EventIndex from "../../../src/indexing/EventIndex";

jest.mock("../../../src/indexing/EventIndex");

afterEach(() => {
    jest.restoreAllMocks();
});

describe("EventIndexPeg", () => {
    describe("initEventIndex", () => {
        it("passes tokenizerMode to initEventIndex", async () => {
            const mockIndexingManager = {
                initEventIndex: jest.fn().mockResolvedValue(undefined),
                getUserVersion: jest.fn().mockResolvedValue(1),
                isEventIndexEmpty: jest.fn().mockResolvedValue(false),
            } as any as Mocked<BaseEventIndexManager>;
            mockPlatformPeg({ getEventIndexingManager: () => mockIndexingManager });

            jest.spyOn(MatrixClientPeg, "get").mockReturnValue({
                getUserId: () => "@user:example.org",
                getDeviceId: () => "DEVICE123",
                on: jest.fn(),
                removeListener: jest.fn(),
            } as any);

            jest.spyOn(SettingsStore, "getValueAt").mockImplementation((_level, settingName): any => {
                if (settingName === "tokenizerMode") return "ngram";
                if (settingName === "crawlerSleepTime") return 3000;
                return undefined;
            });

            const peg = new EventIndexPeg();
            await peg.initEventIndex();

            expect(mockIndexingManager.initEventIndex).toHaveBeenCalledWith("@user:example.org", "DEVICE123", "ngram");
        });

        it("passes language tokenizer mode by default", async () => {
            const mockIndexingManager = {
                initEventIndex: jest.fn().mockResolvedValue(undefined),
                getUserVersion: jest.fn().mockResolvedValue(1),
                isEventIndexEmpty: jest.fn().mockResolvedValue(false),
            } as any as Mocked<BaseEventIndexManager>;
            mockPlatformPeg({ getEventIndexingManager: () => mockIndexingManager });

            jest.spyOn(MatrixClientPeg, "get").mockReturnValue({
                getUserId: () => "@user:example.org",
                getDeviceId: () => "DEVICE123",
                on: jest.fn(),
                removeListener: jest.fn(),
            } as any);

            jest.spyOn(SettingsStore, "getValueAt").mockImplementation((_level, settingName): any => {
                if (settingName === "tokenizerMode") return "language";
                if (settingName === "crawlerSleepTime") return 3000;
                return undefined;
            });

            const peg = new EventIndexPeg();
            await peg.initEventIndex();

            expect(mockIndexingManager.initEventIndex).toHaveBeenCalledWith(
                "@user:example.org",
                "DEVICE123",
                "language",
            );
        });

        it("sets forceAddInitialCheckpoints when database was recreated", async () => {
            const mockIndex = {
                setForceAddInitialCheckpoints: jest.fn(),
                init: jest.fn().mockResolvedValue(undefined),
            };
            (EventIndex as unknown as jest.Mock).mockImplementation(() => mockIndex);

            const mockIndexingManager = {
                initEventIndex: jest.fn().mockResolvedValue({ wasRecreated: true }),
                getUserVersion: jest.fn().mockResolvedValue(1),
                isEventIndexEmpty: jest.fn().mockResolvedValue(false),
            } as any as Mocked<BaseEventIndexManager>;
            mockPlatformPeg({ getEventIndexingManager: () => mockIndexingManager });

            jest.spyOn(MatrixClientPeg, "get").mockReturnValue({
                getUserId: () => "@user:example.org",
                getDeviceId: () => "DEVICE123",
                on: jest.fn(),
                removeListener: jest.fn(),
            } as any);

            jest.spyOn(SettingsStore, "getValueAt").mockImplementation((_level, settingName): any => {
                if (settingName === "tokenizerMode") return "ngram";
                if (settingName === "crawlerSleepTime") return 3000;
                return undefined;
            });

            const peg = new EventIndexPeg();
            await peg.initEventIndex();

            expect(mockIndex.setForceAddInitialCheckpoints).toHaveBeenCalledWith(true);
        });

        it("sets forceAddInitialCheckpoints when index is empty", async () => {
            const mockIndex = {
                setForceAddInitialCheckpoints: jest.fn(),
                init: jest.fn().mockResolvedValue(undefined),
            };
            (EventIndex as unknown as jest.Mock).mockImplementation(() => mockIndex);

            const mockIndexingManager = {
                initEventIndex: jest.fn().mockResolvedValue(undefined),
                getUserVersion: jest.fn().mockResolvedValue(1),
                isEventIndexEmpty: jest.fn().mockResolvedValue(true),
                setUserVersion: jest.fn().mockResolvedValue(undefined),
            } as any as Mocked<BaseEventIndexManager>;
            mockPlatformPeg({ getEventIndexingManager: () => mockIndexingManager });

            jest.spyOn(MatrixClientPeg, "get").mockReturnValue({
                getUserId: () => "@user:example.org",
                getDeviceId: () => "DEVICE123",
                on: jest.fn(),
                removeListener: jest.fn(),
            } as any);

            jest.spyOn(SettingsStore, "getValueAt").mockImplementation((_level, settingName): any => {
                if (settingName === "tokenizerMode") return "ngram";
                if (settingName === "crawlerSleepTime") return 3000;
                return undefined;
            });

            const peg = new EventIndexPeg();
            await peg.initEventIndex();

            expect(mockIndexingManager.setUserVersion).toHaveBeenCalledWith(1);
            expect(mockIndex.setForceAddInitialCheckpoints).toHaveBeenCalledWith(true);
        });

        it("reinitializes index when userVersion is 0 and index is not empty", async () => {
            const mockIndex = {
                setForceAddInitialCheckpoints: jest.fn(),
                init: jest.fn().mockResolvedValue(undefined),
            };
            (EventIndex as unknown as jest.Mock).mockImplementation(() => mockIndex);

            const mockIndexingManager = {
                initEventIndex: jest.fn().mockResolvedValue(undefined),
                getUserVersion: jest.fn().mockResolvedValue(0),
                isEventIndexEmpty: jest.fn().mockResolvedValue(false),
                closeEventIndex: jest.fn().mockResolvedValue(undefined),
                deleteEventIndex: jest.fn().mockResolvedValue(undefined),
                setUserVersion: jest.fn().mockResolvedValue(undefined),
            } as any as Mocked<BaseEventIndexManager>;
            mockPlatformPeg({ getEventIndexingManager: () => mockIndexingManager });

            jest.spyOn(MatrixClientPeg, "get").mockReturnValue({
                getUserId: () => "@user:example.org",
                getDeviceId: () => "DEVICE123",
                on: jest.fn(),
                removeListener: jest.fn(),
            } as any);

            jest.spyOn(SettingsStore, "getValueAt").mockImplementation((_level, settingName): any => {
                if (settingName === "tokenizerMode") return "ngram";
                if (settingName === "crawlerSleepTime") return 3000;
                return undefined;
            });

            const peg = new EventIndexPeg();
            await peg.initEventIndex();

            expect(mockIndexingManager.closeEventIndex).toHaveBeenCalled();
            expect(mockIndexingManager.deleteEventIndex).toHaveBeenCalled();
            expect(mockIndexingManager.initEventIndex).toHaveBeenCalledTimes(2);
            expect(mockIndexingManager.initEventIndex).toHaveBeenNthCalledWith(
                2,
                "@user:example.org",
                "DEVICE123",
                "ngram",
            );
        });
    });
});
