/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import DMRoomMap from "../DMRoomMap";
import { privateShouldBeEncrypted } from "../rooms";

/**
 * Tests whether a DM room with exactly one third-party invite should be encrypted.
 * If it should be encrypted, the third-party invitation event is also returned.
 */
export const shouldEncryptRoomWithSingle3rdPartyInvite = (
    room: Room,
): { shouldEncrypt: true; inviteEvent: MatrixEvent } | { shouldEncrypt: false; inviteEvent?: undefined } => {
    // encryption not promoted via .well-known
    if (!privateShouldBeEncrypted(room.client)) return { shouldEncrypt: false };

    // not a DM room
    if (!DMRoomMap.shared().getRoomIds().has(room.roomId)) return { shouldEncrypt: false };

    // more than one room member / invite
    if (room.getInvitedAndJoinedMemberCount() !== 1) return { shouldEncrypt: false };

    const thirdPartyInvites = room.currentState.getStateEvents("m.room.third_party_invite") || [];

    if (thirdPartyInvites.length === 1) {
        return {
            shouldEncrypt: true,
            inviteEvent: thirdPartyInvites[0],
        };
    }

    return { shouldEncrypt: false };
};
