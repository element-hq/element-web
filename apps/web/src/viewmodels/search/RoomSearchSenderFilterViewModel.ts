/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room } from "matrix-js-sdk/src/matrix";
import { BaseViewModel } from "@element-hq/web-shared-components";

/**
 * A selectable sender option for the search `from:` filter.
 */
export interface SenderOption {
    /** Full MXID, matched against {@link IRoomEventFilter.senders} / a result's `sender`. */
    userId: string;
    /** Display name to show in the picker. */
    name: string;
}

/**
 * Reactive state for the search sender-filter picker.
 */
export interface RoomSearchSenderFilterSnapshot {
    /** The room's joined members (excluding the current user), sorted by display name, offered as `from:` options. */
    members: SenderOption[];
}

/**
 * Constructor props for {@link RoomSearchSenderFilterViewModel}.
 */
export interface RoomSearchSenderFilterProps {
    /** The room whose members can be picked as `from:` filters. */
    room: Room;
}

function computeMembers(room: Room): SenderOption[] {
    const myUserId = room.myUserId;
    return room
        .getJoinedMembers()
        .filter((m) => m.userId !== myUserId)
        .map((m) => ({ userId: m.userId, name: m.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * MVVM-v2 view model backing the search `from:`/sender filter picker.
 *
 * Owns the candidate sender catalogue — the room's joined members, minus the current user, sorted by display
 * name — so the View stays dumb. The selected senders are NOT held here: they are owned by RoomView's search
 * session and threaded down to the View as a prop; the View toggles them through an injected callback.
 */
export class RoomSearchSenderFilterViewModel extends BaseViewModel<
    RoomSearchSenderFilterSnapshot,
    RoomSearchSenderFilterProps
> {
    public constructor(props: RoomSearchSenderFilterProps) {
        super(props, { members: computeMembers(props.room) });
    }
}
