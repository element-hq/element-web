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

const SNOOZE_KEY = "mx_snooze_bulk_unverified_device_nag";
// one week
const snoozePeriod = 1000 * 60 * 60 * 24 * 7;
export const snoozeBulkUnverifiedDeviceReminder = (): void => {
    try {
        localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch (error) {
        logger.error("Failed to persist bulk unverified device nag snooze", error);
    }
};

export const isBulkUnverifiedDeviceReminderSnoozed = (): boolean => {
    try {
        const snoozedTimestamp = localStorage.getItem(SNOOZE_KEY);

        const parsedTimestamp = Number.parseInt(snoozedTimestamp || "", 10);

        return Number.isInteger(parsedTimestamp) && parsedTimestamp + snoozePeriod > Date.now();
    } catch (error) {
        return false;
    }
};
