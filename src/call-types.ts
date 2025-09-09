/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType } from "matrix-js-sdk/src/matrix";
import { NamespacedValue } from "matrix-js-sdk/src/NamespacedValue";

export const JitsiCallMemberEventType = "io.element.video.member";

export interface JitsiCallMemberContent {
    // Connected device IDs
    devices: string[];
    // Time at which this state event should be considered stale
    expires_ts: number;
}

// Element Call no longer sends this event type; it only exists to support timeline rendering of
// group calls from a previous iteration of the group VoIP MSCs (MSC3401) which used it.
export const ElementCallEventType = new NamespacedValue(null, EventType.GroupCallPrefix);

export const ElementCallMemberEventType = new NamespacedValue(null, EventType.GroupCallMemberPrefix);
