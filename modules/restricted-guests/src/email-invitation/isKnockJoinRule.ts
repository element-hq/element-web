/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { JoinRule } from "@element-hq/element-web-module-api";

/**
 * Whether the join rule lets people knock, which is how guests join a room.
 * @param joinRule - The join rule of the room
 */
export function isKnockJoinRule(joinRule: JoinRule): boolean {
    return joinRule === "knock" || joinRule === "knock_restricted";
}
