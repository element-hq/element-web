/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The features which have a release announcement, shown in the array order.
 * We include a `_test_dummy` value to enable tests to function even where there are no running release announcements.
 * This value must be at the end of the list.
 *
 * Kept apart from {@link ReleaseAnnouncementStore} and free of imports, so that the Playwright tests can import it
 * to hide every release announcement by default.
 */
export const FEATURES = ["room_list_section", "_test_dummy1", "_test_dummy2"] as const;

/**
 * All the features that can be shown in the release announcements.
 */
export type Feature = (typeof FEATURES)[number];
