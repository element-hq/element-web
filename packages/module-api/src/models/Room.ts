/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Watchable } from "../api/watchable";
import { type RoomStateEvent } from "./RoomStateEvent";

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
     * {@link Watchable} holding whether this room is encrypted.
     * The value is only kept up to date while it is being watched.
     * The value is `undefined` until the encryption status has been determined.
     */
    isEncrypted: Watchable<boolean | undefined>;
    /**
     * Get the current state events of one type in this joined room.
     * Snapshots are detached mutable copies and are refreshed while watched.
     * @param eventType - The Matrix event type to read.
     * @alpha
     */
    getStateEvents(eventType: string): Watchable<RoomStateEvent[]>;
    /**
     * Get the timestamp of the last message in this room.
     * @returns last active timestamp
     */
    getLastActiveTimestamp: () => number;
}
