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

import {
    isBulkUnverifiedDeviceReminderSnoozed,
    snoozeBulkUnverifiedDeviceReminder,
} from "../../../src/utils/device/snoozeBulkUnverifiedDeviceReminder";

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
