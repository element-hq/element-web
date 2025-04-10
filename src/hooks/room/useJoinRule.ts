/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";
import { EventType, type MatrixEvent, type Room, RoomStateEvent, type JoinRule } from "matrix-js-sdk/src/matrix";
import { type Optional } from "matrix-events-sdk";

import { useTypedEventEmitter } from "../useEventEmitter";

/**
 * Helper to retrieve the join rules for given room
 * @param room
 * @returns the current join rule
 */
export function useJoinRule(room?: Room): Optional<JoinRule> {
    const [topic, setJoinRule] = useState(room?.getJoinRule());
    useTypedEventEmitter(room?.currentState, RoomStateEvent.Events, (ev: MatrixEvent) => {
        if (ev.getType() !== EventType.RoomJoinRules) return;
        setJoinRule(room?.getJoinRule());
    });
    useEffect(() => {
        setJoinRule(room?.getJoinRule());
    }, [room]);

    return topic;
}
