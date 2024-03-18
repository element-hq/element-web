/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { useMemo, useState } from "react";
import { Room, RoomEvent, RoomMember, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { Membership } from "matrix-js-sdk/src/types";
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
