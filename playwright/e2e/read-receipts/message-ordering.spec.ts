/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/* See readme.md for tips on writing these tests. */

import { test } from ".";

test.describe("Read receipts", { tag: "@mergequeue" }, () => {
    test.describe("Message ordering", () => {
        test.describe("in the main timeline", () => {
            test.fixme(
                "A receipt for the last event in sync order (even with wrong ts) marks a room as read",
                () => {},
            );
            test.fixme(
                "A receipt for a non-last event in sync order (even when ts makes it last) leaves room unread",
                () => {},
            );
        });

        test.describe("in threads", () => {
            // These don't pass yet - we need MSC4033 - we don't even know the Sync order yet
            test.fixme(
                "A receipt for the last event in sync order (even with wrong ts) marks a thread as read",
                () => {},
            );
            test.fixme(
                "A receipt for a non-last event in sync order (even when ts makes it last) leaves thread unread",
                () => {},
            );

            // These pass now and should not later - we should use order from MSC4033 instead of ts
            // These are broken out
            test.fixme(
                "A receipt for last threaded event in ts order (even when it was received non-last) marks a thread as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last threaded event in ts order (even when it was received last) leaves thread unread",
                () => {},
            );
            test.fixme(
                "A receipt for last threaded edit in ts order (even when it was received non-last) marks a thread as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last threaded edit in ts order (even when it was received last) leaves thread unread",
                () => {},
            );
            test.fixme(
                "A receipt for last threaded reaction in ts order (even when it was received non-last) marks a thread as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last threaded reaction in ts order (even when it was received last) leaves thread unread",
                () => {},
            );
        });

        test.describe("thread roots", () => {
            test.fixme(
                "A receipt for last reaction to thread root in sync order (even when ts makes it last) marks room as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last reaction to thread root in sync order (even when ts makes it last) leaves room unread",
                () => {},
            );
            test.fixme(
                "A receipt for last edit to thread root in sync order (even when ts makes it last) marks room as read",
                () => {},
            );
            test.fixme(
                "A receipt for non-last edit to thread root in sync order (even when ts makes it last) leaves room unread",
                () => {},
            );
        });
    });
});
