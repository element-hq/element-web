/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    humanReadableNotificationLevel,
    NotificationLevel,
} from "../../../../src/stores/notifications/NotificationLevel";

describe("NotificationLevel", () => {
    describe("humanReadableNotificationLevel", () => {
        it.each([
            [NotificationLevel.None, "None"],
            [NotificationLevel.Activity, "Activity"],
            [NotificationLevel.Notification, "Notification"],
            [NotificationLevel.Highlight, "Highlight"],
            [NotificationLevel.Unsent, "Unsent"],
        ])("correctly maps the output", (color, output) => {
            expect(humanReadableNotificationLevel(color)).toBe(output);
        });
    });
});
