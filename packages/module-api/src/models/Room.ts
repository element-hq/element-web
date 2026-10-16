/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Watchable } from "../api/watchable";

/**
 * The join rule of a room, from the `m.room.join_rules` state event.
 * @public
 */
export type JoinRule = "public" | "invite" | "knock" | "restricted" | "private";

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
    /**
     * Get a shareable link to this room, using the permalink prefix configured in element-web.
     * @returns the permalink of the room
     */
    getPermalink: () => string;
}
