/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useMemo, useState } from "react";
import { type Room, RoomEvent, type RoomMember, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { type Membership } from "matrix-js-sdk/src/types";
import { throttle } from "lodash";

import { useTypedEventEmitter } from "./useEventEmitter";

// Hook to simplify watching Matrix Room joined members
export const useRoomMembers = (room: Room, throttleWait = 250): RoomMember[] => {
    const [members, setMembers] = useState<RoomMember[]>(room.getJoinedMembers());

    const throttledUpdate = useMemo(
        () =>
            throttle(
                () => {
                    setMembers(room.getJoinedMembers());
                },
                throttleWait,
                { leading: true, trailing: true },
            ),
        [room, throttleWait],
    );

    useTypedEventEmitter(room.currentState, RoomStateEvent.Members, throttledUpdate);
    return members;
};

type RoomMemberCountOpts = {
    /**
     * Wait time between room member count update
     */
    throttleWait?: number;
};

/**
 * Returns a count of members in a given room
 * @param room the room to track.
 * @param opts The options.
 * @returns the room member count.
 */
export const useRoomMemberCount = (
    room: Room,
    { throttleWait }: RoomMemberCountOpts = { throttleWait: 250 },
): number => {
    const [count, setCount] = useState<number>(room.getJoinedMemberCount());
    const throttledUpdate = useMemo(
        () =>
            throttle(
                () => {
                    setCount(room.getJoinedMemberCount());
                },
                throttleWait,
                { leading: true, trailing: true },
            ),
        [room, throttleWait],
    );

    useTypedEventEmitter(room.currentState, RoomStateEvent.Members, throttledUpdate);

    /**
     * `room.getJoinedMemberCount()` caches the member count behind the room summary
     * So we need to re-compute the member count when the summary gets updated
     */
    useTypedEventEmitter(room, RoomEvent.Summary, throttledUpdate);
    return count;
};

// Hook to simplify watching the local user's membership in a room
export const useMyRoomMembership = (room: Room): Membership => {
    const [membership, setMembership] = useState<Membership>(room.getMyMembership());
    useTypedEventEmitter(room, RoomEvent.MyMembership, () => {
        setMembership(room.getMyMembership());
    });
    return membership;
};
