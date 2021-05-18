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

import {useState} from "react";
import {Room} from "matrix-js-sdk/src/models/room";
import {RoomMember} from "matrix-js-sdk/src/models/room-member";

import {useEventEmitter} from "./useEventEmitter";
import {throttle} from "lodash";

// Hook to simplify watching Matrix Room joined members
export const useRoomMembers = (room: Room, throttleWait = 250) => {
    const [members, setMembers] = useState<RoomMember[]>(room.getJoinedMembers());
    useEventEmitter(room.currentState, "RoomState.members", throttle(() => {
        setMembers(room.getJoinedMembers());
    }, throttleWait, {leading: true, trailing: true}));
    return members;
};

// Hook to simplify watching Matrix Room joined member count
export const useRoomMemberCount = (room: Room, throttleWait = 250) => {
    const [count, setCount] = useState<number>(room.getJoinedMemberCount());
    useEventEmitter(room.currentState, "RoomState.members", throttle(() => {
        setCount(room.getJoinedMemberCount());
    }, throttleWait, {leading: true, trailing: true}));
    return count;
};
