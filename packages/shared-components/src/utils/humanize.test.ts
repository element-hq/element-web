/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { humanizeTime } from "./humanize";

describe("humanizeTime", () => {
    const now = new Date("2025-08-01T12:00:00Z").getTime();

    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(now);
    });

    it.each([
        // Past
        ["returns 'a few seconds ago' for <15s ago", now - 5000, "a few seconds ago"],
        ["returns 'about a minute ago' for <75s ago", now - 60000, "about a minute ago"],
        ["returns '20 minutes ago' for <45min ago", now - 20 * 60000, "20 minutes ago"],
        ["returns 'about an hour ago' for <75min ago", now - 70 * 60000, "about an hour ago"],
        ["returns '5 hours ago' for <23h ago", now - 5 * 3600000, "5 hours ago"],
        ["returns 'about a day ago' for <26h ago", now - 25 * 3600000, "about a day ago"],
        ["returns '3 days ago' for >26h ago", now - 3 * 24 * 3600000, "3 days ago"],
        // Future
        ["returns 'a few seconds from now' for <15s ahead", now + 5000, "a few seconds from now"],
        ["returns 'about a minute from now' for <75s ahead", now + 60000, "about a minute from now"],
        ["returns '20 minutes from now' for <45min ahead", now + 20 * 60000, "20 minutes from now"],
        ["returns 'about an hour from now' for <75min ahead", now + 70 * 60000, "about an hour from now"],
        ["returns '5 hours from now' for <23h ahead", now + 5 * 3600000, "5 hours from now"],
        ["returns 'about a day from now' for <26h ahead", now + 25 * 3600000, "about a day from now"],
        ["returns '3 days from now' for >26h ahead", now + 3 * 24 * 3600000, "3 days from now"],
    ])("%s", (_, date, expected) => {
        expect(humanizeTime(date)).toBe(expected);
    });
});
