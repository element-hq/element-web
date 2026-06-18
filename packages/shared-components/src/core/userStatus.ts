/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * A tuple of an emoji and string representing a user's MSC4426 status.
 * The emoji should be a single grapheme cluster.
 */
export interface UserStatus {
    emoji: string;
    text: string;
}
