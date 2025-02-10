/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* See readme.md for tips on writing these tests. */

import { test } from ".";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.describe("Notifications", () => {
        test.describe("in the main timeline", () => {
            test.fixme("A new message that mentions me shows a notification", () => {});
            test.fixme(
                "Reading a notifying message reduces the notification count in the room list, space and tab",
                () => {},
            );
            test.fixme(
                "Reading the last notifying message removes the notification marker from room list, space and tab",
                () => {},
            );
            test.fixme("Editing a message to mentions me shows a notification", () => {});
            test.fixme("Reading the last notifying edited message removes the notification marker", () => {});
            test.fixme("Redacting a notifying message removes the notification marker", () => {});
        });

        test.describe("in threads", () => {
            test.fixme("A new threaded message that mentions me shows a notification", () => {});
            test.fixme("Reading a notifying threaded message removes the notification count", () => {});
            test.fixme(
                "Notification count remains steady when reading threads that contain seen notifications",
                () => {},
            );
            test.fixme(
                "Notification count remains steady when paging up thread view even when threads contain seen notifications",
                () => {},
            );
            test.fixme(
                "Notification count remains steady when paging up thread view after mark as unread even if older threads contain notifications",
                () => {},
            );
            test.fixme("Redacting a notifying threaded message removes the notification marker", () => {});
        });
    });
});
