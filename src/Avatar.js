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

'use strict';
import {MatrixClientPeg} from './MatrixClientPeg';
import DMRoomMap from './utils/DMRoomMap';
import {getHttpUriForMxc} from "matrix-js-sdk/src/content-repo";

export function avatarUrlForMember(member, width, height, resizeMethod) {
    let url;
    if (member && member.getAvatarUrl) {
        url = member.getAvatarUrl(
            MatrixClientPeg.get().getHomeserverUrl(),
            Math.floor(width * window.devicePixelRatio),
            Math.floor(height * window.devicePixelRatio),
            resizeMethod,
            false,
            false,
        );
    }
    if (!url) {
        // member can be null here currently since on invites, the JS SDK
        // does not have enough info to build a RoomMember object for
        // the inviter.
        url = defaultAvatarUrlForString(member ? member.userId : '');
    }
    return url;
}

export function avatarUrlForUser(user, width, height, resizeMethod) {
    const url = getHttpUriForMxc(
        MatrixClientPeg.get().getHomeserverUrl(), user.avatarUrl,
        Math.floor(width * window.devicePixelRatio),
        Math.floor(height * window.devicePixelRatio),
        resizeMethod,
    );
    if (!url || url.length === 0) {
        return null;
    }
    return url;
}

export function defaultAvatarUrlForString(s) {
    const images = ['03b381', '368bd6', 'ac3ba8'];
    let total = 0;
    for (let i = 0; i < s.length; ++i) {
        total += s.charCodeAt(i);
    }
    return require('../res/img/' + images[total % images.length] + '.png');
}

/**
 * returns the first (non-sigil) character of 'name',
 * converted to uppercase
 * @param {string} name
 * @return {string} the first letter
 */
export function getInitialLetter(name) {
    if (!name) {
        // XXX: We should find out what causes the name to sometimes be falsy.
        console.trace("`name` argument to `getInitialLetter` not supplied");
        return undefined;
    }
    if (name.length < 1) {
        return undefined;
    }

    let idx = 0;
    const initial = name[0];
    if ((initial === '@' || initial === '#' || initial === '+') && name[1]) {
        idx++;
    }

    // string.codePointAt(0) would do this, but that isn't supported by
    // some browsers (notably PhantomJS).
    let chars = 1;
    const first = name.charCodeAt(idx);

    // check if it’s the start of a surrogate pair
    if (first >= 0xD800 && first <= 0xDBFF && name[idx+1]) {
        const second = name.charCodeAt(idx+1);
        if (second >= 0xDC00 && second <= 0xDFFF) {
            chars++;
        }
    }

    const firstChar = name.substring(idx, idx+chars);
    return firstChar.toUpperCase();
}

export function avatarUrlForRoom(room, width, height, resizeMethod) {
    if (!room) return null; // null-guard

    const explicitRoomAvatar = room.getAvatarUrl(
        MatrixClientPeg.get().getHomeserverUrl(),
        width,
        height,
        resizeMethod,
        false,
    );
    if (explicitRoomAvatar) {
        return explicitRoomAvatar;
    }

    let otherMember = null;
    const otherUserId = DMRoomMap.shared().getUserIdForRoomId(room.roomId);
    if (otherUserId) {
        otherMember = room.getMember(otherUserId);
    } else {
        // if the room is not marked as a 1:1, but only has max 2 members
        // then still try to show any avatar (pref. other member)
        otherMember = room.getAvatarFallbackMember();
    }
    if (otherMember) {
        return otherMember.getAvatarUrl(
            MatrixClientPeg.get().getHomeserverUrl(),
            width,
            height,
            resizeMethod,
            false,
        );
    }
    return null;
}
