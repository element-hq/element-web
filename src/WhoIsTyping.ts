/*
Copyright 2017 Vector Creations Ltd

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

import { Room } from "matrix-js-sdk/src/models/room";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { _t } from "./languageHandler";

export function usersTypingApartFromMeAndIgnored(room: Room): RoomMember[] {
    return usersTyping(room, [room.client.getSafeUserId()].concat(room.client.getIgnoredUsers()));
}

export function usersTypingApartFromMe(room: Room): RoomMember[] {
    return usersTyping(room, [room.client.getSafeUserId()]);
}

/**
 * Given a Room object and, optionally, a list of userID strings
 * to exclude, return a list of user objects who are typing.
 * @param {Room} room: room object to get users from.
 * @param {string[]} exclude: list of user mxids to exclude.
 * @returns {RoomMember[]} list of user objects who are typing.
 */
export function usersTyping(room: Room, exclude: string[] = []): RoomMember[] {
    const whoIsTyping: RoomMember[] = [];

    const memberKeys = Object.keys(room.currentState.members);
    for (const userId of memberKeys) {
        if (room.currentState.members[userId].typing) {
            if (exclude.indexOf(userId) === -1) {
                whoIsTyping.push(room.currentState.members[userId]);
            }
        }
    }

    return whoIsTyping;
}

export function whoIsTypingString(whoIsTyping: RoomMember[], limit: number): string {
    let othersCount = 0;
    if (whoIsTyping.length > limit) {
        othersCount = whoIsTyping.length - limit + 1;
    }

    if (whoIsTyping.length === 0) {
        return "";
    } else if (whoIsTyping.length === 1) {
        return _t("%(displayName)s is typing …", { displayName: whoIsTyping[0].name });
    }

    const names = whoIsTyping.map((m) => m.name);

    if (othersCount >= 1) {
        return _t("%(names)s and %(count)s others are typing …", {
            names: names.slice(0, limit - 1).join(", "),
            count: othersCount,
        });
    } else {
        const lastPerson = names.pop();
        return _t("%(names)s and %(lastPerson)s are typing …", { names: names.join(", "), lastPerson: lastPerson });
    }
}
