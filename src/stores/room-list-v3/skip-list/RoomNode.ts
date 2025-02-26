/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Room } from "matrix-js-sdk/src/matrix";

/**
 * Room skip list stores room nodes.
 * These hold the actual room object and provides references to other nodes
 * in different levels.
 */
export class RoomNode {
    public constructor(public readonly room: Room) {}

    /**
     * This array holds references to the next node in a given level.
     * eg: next[i] gives the next room node from this room node in level i.
     */
    public next: RoomNode[] = [];

    /**
     * This array holds references to the previous node in a given level.
     * eg: previous[i] gives the previous room node from this room node in level i.
     */
    public previous: RoomNode[] = [];
}
