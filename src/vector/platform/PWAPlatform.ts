/*
Copyright 2020-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import WebPlatform from "./WebPlatform";

export default class PWAPlatform extends WebPlatform {
    public setNotificationCount(count: number): void {
        if (!navigator.setAppBadge) return super.setNotificationCount(count);
        if (this.notificationCount === count) return;
        this.notificationCount = count;

        navigator.setAppBadge(count).catch((e) => {
            logger.error("Failed to update PWA app badge", e);
        });
    }
}
