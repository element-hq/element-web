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

import { useState } from "react";
import { Room, RoomEvent, RoomMember, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { throttle } from "lodash";

import { useTypedEventEmitter } from "./useEventEmitter";
import { getJoinedNonFunctionalMembers } from "../utils/room/getJoinedNonFunctionalMembers";

// Hook to simplify watching Matrix Room joined members
export const useRoomMembers = (room: Room, throttleWait = 250): RoomMember[] => {
    const [members, setMembers] = useState<RoomMember[]>(room.getJoinedMembers());
    useTypedEventEmitter(
        room.currentState,
        RoomStateEvent.Members,
        throttle(
            () => {
                setMembers(room.getJoinedMembers());
            },
            throttleWait,
            { leading: true, trailing: true },
        ),
    );
    return members;
};

type RoomMemberCountOpts = {
    /**
     * Wait time between room member count update
     */
    throttleWait?: number;
    /**
     * Whether to include functional members (bots, etc...) in the room count
     * @default true
     */
    includeFunctional: boolean;
};

// Hook to simplify watching Matrix Room joined member count
export const useRoomMemberCount = (
    room: Room,
    opts: RoomMemberCountOpts = { throttleWait: 250, includeFunctional: true },
): number => {
    const [count, setCount] = useState<number>(room.getJoinedMemberCount());

    const { throttleWait, includeFunctional } = opts;

    useTypedEventEmitter(
        room.currentState,
        RoomStateEvent.Members,
        throttle(
            () => {
                // At the time where `RoomStateEvent.Members` is emitted the
                // summary API has not had a chance to update the `summaryJoinedMemberCount`
                // value, therefore handling the logic locally here.
                //
                // Tracked as part of https://github.com/vector-im/element-web/issues/26033
                const membersCount = includeFunctional
                    ? room.getMembers().reduce((count, m) => {
                          return m.membership === "join" ? count + 1 : count;
                      }, 0)
                    : getJoinedNonFunctionalMembers(room).length;
                setCount(membersCount);
            },
            throttleWait,
            { leading: true, trailing: true },
        ),
    );
    return count;
};

// Hook to simplify watching the local user's membership in a room
export const useMyRoomMembership = (room: Room): string => {
    const [membership, setMembership] = useState<string>(room.getMyMembership());
    useTypedEventEmitter(room, RoomEvent.MyMembership, () => {
        setMembership(room.getMyMembership());
    });
    return membership;
};
