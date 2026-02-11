/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

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
