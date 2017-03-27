/*
Copyright 2015, 2016 OpenMarket Ltd

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

import MatrixClientPeg from './MatrixClientPeg';
import DMRoomMap from './utils/DMRoomMap';
import q from 'q';

/**
 * Given a room object, return the alias we should use for it,
 * if any. This could be the canonical alias if one exists, otherwise
 * an alias selected arbitrarily but deterministically from the list
 * of aliases. Otherwise return null;
 */
export function getDisplayAliasForRoom(room) {
    return room.getCanonicalAlias() || room.getAliases()[0];
}

/**
 * If the room contains only two members including the logged-in user,
 * return the other one. Otherwise, return null.
 */
export function getOnlyOtherMember(room, me) {
    const joinedMembers = room.getJoinedMembers();

    if (joinedMembers.length === 2) {
        return joinedMembers.filter(function(m) {
            return m.userId !== me.userId;
        })[0];
    }

    return null;
}

export function isConfCallRoom(room, me, conferenceHandler) {
    if (!conferenceHandler) return false;

    if (me.membership != "join") {
        return false;
    }

    const otherMember = getOnlyOtherMember(room, me);
    if (otherMember === null) {
        return false;
    }

    if (conferenceHandler.isConferenceUser(otherMember.userId)) {
        return true;
    }
}

export function looksLikeDirectMessageRoom(room, me) {
    if (me.membership == "join" || me.membership === "ban" ||
        (me.membership === "leave" && me.events.member.getSender() !== me.events.member.getStateKey()))
    {
        // Used to split rooms via tags
        const tagNames = Object.keys(room.tags);
        // Used for 1:1 direct chats
        const members = room.currentState.getMembers();

        // Show 1:1 chats in seperate "Direct Messages" section as long as they haven't
        // been moved to a different tag section
        if (members.length === 2 && !tagNames.length) {
            return true;
        }
    }
    return false;
}

export function guessAndSetDMRoom(room, isDirect) {
    let newTarget;
    if (isDirect) {
        const guessedTarget = guessDMRoomTarget(
            room, room.getMember(MatrixClientPeg.get().credentials.userId),
        );
        newTarget = guessedTarget.userId;
    } else {
        newTarget = null;
    }

    return setDMRoom(room.roomId, newTarget);
}

/**
 * Marks or unmarks the given room as being as a DM room.
 * @param {string} roomId The ID of the room to modify
 * @param {string} userId The user ID of the desired DM
                   room target user or null to un-mark
                   this room as a DM room
 * @returns {object} A promise
 */
export function setDMRoom(roomId, userId) {
    if (MatrixClientPeg.get().isGuest()) {
        return q();
    }

    const mDirectEvent = MatrixClientPeg.get().getAccountData('m.direct');
    let dmRoomMap = {};

    if (mDirectEvent !== undefined) dmRoomMap = mDirectEvent.getContent();

    // remove it from the lists of any others users
    // (it can only be a DM room for one person)
    for (const thisUserId of Object.keys(dmRoomMap)) {
        const roomList = dmRoomMap[thisUserId];

        if (thisUserId != userId) {
            const indexOfRoom = roomList.indexOf(roomId);
            if (indexOfRoom > -1) {
                roomList.splice(indexOfRoom, 1);
            }
        }
    }

    // now add it, if it's not already there
    if (userId) {
        const roomList = dmRoomMap[userId] || [];
        if (roomList.indexOf(roomId) == -1) {
            roomList.push(roomId);
        }
        dmRoomMap[userId] = roomList;
    }


    return MatrixClientPeg.get().setAccountData('m.direct', dmRoomMap);
}

/**
 * Given a room, estimate which of its members is likely to
 * be the target if the room were a DM room and return that user.
 */
export function guessDMRoomTarget(room, me) {
    let oldestTs;
    let oldestUser;

    // Pick the user who's been here longest (and isn't us)
    for (const user of room.currentState.getMembers()) {
        if (user.userId == me.userId) continue;

        if (oldestTs === undefined || user.events.member.getTs() < oldestTs) {
            oldestUser = user;
            oldestTs = user.events.member.getTs();
        }
    }

    if (oldestUser === undefined) return me;
    return oldestUser;
}
