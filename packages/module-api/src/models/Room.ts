/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Watchable } from "../api/watchable";
import type { MatrixEvent } from "./event";

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
    /**
     * Get a state event from the room's current state.
     * @param eventType - The type of state event to retrieve.
     * @param stateKey - The state key to look up. Defaults to the empty string.
     * @returns The state event, or null if not found.
     */
    getStateEvent: (eventType: string, stateKey?: string) => Watchable<MatrixEvent | null>;
    /**
     * Whether this room is encrypted or not.
     */
    isEncrypted: () => boolean;
}
