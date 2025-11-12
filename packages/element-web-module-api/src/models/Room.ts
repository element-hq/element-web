/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Watchable } from "../api/watchable";

/**
 * Represents a room from element-web.
 * @public
 */
export interface Room {
    /**
     * Id of this room.
     */
    id: string;
    /**
     * {@link Watchable} holding the name for this room.
     */
    name: Watchable<string>;
    /**
     * Get the timestamp of the last message in this room.
     * @returns last active timestamp
     */
    getLastActiveTimestamp: () => number;
}
