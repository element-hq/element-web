/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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
    } catch {
        return false;
    }
};
