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
    });
});
