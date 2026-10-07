/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Watchable } from "../api/watchable";
import { type RoomStateEvent } from "./RoomStateEvent";

/**
 * The join rule of a room, from the `m.room.join_rules` state event.
 * @public
 */
export type JoinRule = "public" | "invite" | "knock" | "restricted" | "knock_restricted" | "private";

/**
 * The history visibility of a room, from the `m.room.history_visibility` state event.
 * @public
 */
export type HistoryVisibility = "invited" | "joined" | "shared" | "world_readable";

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
     * {@link Watchable} holding the join rule of this room, from the `m.room.join_rules` state event.
     * Defaults to `invite`.
     */
    joinRule: Watchable<JoinRule>;
    /**
     * Change the join rule of this room by sending a new `m.room.join_rules` state event.
     * The user needs permission to send this state event.
     * @param joinRule - the new join rule
     */
    setJoinRule: (joinRule: JoinRule) => Promise<void>;
    /**
     * {@link Watchable} holding the history visibility of this room, from the `m.room.history_visibility` state event.
     * Defaults to `shared`.
     */
    historyVisibility: Watchable<HistoryVisibility>;
    /**
     * Whether the current user can invite new members to this room.
     */
    canInvite: () => boolean;
    /**
     * Whether the current user can change the join rule of this room.
     */
    canChangeJoinRule: () => boolean;
    /**
     * Whether the version of this room supports the `knock` join rule.
     */
    supportsKnock: () => boolean;
    /**
     * Get the timestamp of the last message in this room.
     * @returns last active timestamp
     */
    getLastActiveTimestamp: () => number;
}
