/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import {
    isBulkUnverifiedDeviceReminderSnoozed,
    snoozeBulkUnverifiedDeviceReminder,
} from "../../../../src/utils/device/snoozeBulkUnverifiedDeviceReminder";

const SNOOZE_KEY = "mx_snooze_bulk_unverified_device_nag";

describe("snooze bulk unverified device nag", () => {
    const localStorageSetSpy = jest.spyOn(localStorage.__proto__, "setItem");
    const localStorageGetSpy = jest.spyOn(localStorage.__proto__, "getItem");
    const localStorageRemoveSpy = jest.spyOn(localStorage.__proto__, "removeItem");

    // 14.03.2022 16:15
    const now = 1647270879403;

    beforeEach(() => {
        localStorageSetSpy.mockClear().mockImplementation(() => {});
        localStorageGetSpy.mockClear().mockReturnValue(null);
        localStorageRemoveSpy.mockClear().mockImplementation(() => {});

        jest.spyOn(Date, "now").mockReturnValue(now);
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe("snoozeBulkUnverifiedDeviceReminder()", () => {
        it("sets the current time in local storage", () => {
            snoozeBulkUnverifiedDeviceReminder();

            expect(localStorageSetSpy).toHaveBeenCalledWith(SNOOZE_KEY, now.toString());
        });

        it("catches an error from localstorage", () => {
            const loggerErrorSpy = jest.spyOn(logger, "error");
            localStorageSetSpy.mockImplementation(() => {
                throw new Error("oups");
            });
            snoozeBulkUnverifiedDeviceReminder();
            expect(loggerErrorSpy).toHaveBeenCalled();
        });
    });

    describe("isBulkUnverifiedDeviceReminderSnoozed()", () => {
        it("returns false when there is no snooze in storage", () => {
            const result = isBulkUnverifiedDeviceReminderSnoozed();
            expect(localStorageGetSpy).toHaveBeenCalledWith(SNOOZE_KEY);
            expect(result).toBe(false);
        });

        it("catches an error from localstorage and returns false", () => {
            const loggerErrorSpy = jest.spyOn(logger, "error");
            localStorageGetSpy.mockImplementation(() => {
                throw new Error("oups");
            });
            const result = isBulkUnverifiedDeviceReminderSnoozed();
            expect(result).toBe(false);
            expect(loggerErrorSpy).toHaveBeenCalled();
        });

        it("returns false when snooze timestamp in storage is not a number", () => {
            localStorageGetSpy.mockReturnValue("test");
            const result = isBulkUnverifiedDeviceReminderSnoozed();
            expect(result).toBe(false);
        });

        it("returns false when snooze timestamp in storage is over a week ago", () => {
            const msDay = 1000 * 60 * 60 * 24;
            // snoozed 8 days ago
            localStorageGetSpy.mockReturnValue(now - msDay * 8);
            const result = isBulkUnverifiedDeviceReminderSnoozed();
            expect(result).toBe(false);
        });

        it("returns true when snooze timestamp in storage is less than a week ago", () => {
            const msDay = 1000 * 60 * 60 * 24;
            // snoozed 8 days ago
            localStorageGetSpy.mockReturnValue(now - msDay * 6);
            const result = isBulkUnverifiedDeviceReminderSnoozed();
            expect(result).toBe(true);
        });
    });
});
