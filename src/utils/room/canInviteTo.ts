/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { JoinRule, type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { UIComponent } from "../../settings/UIFeature";

/**
 * Can a user invite new members to the room
 * @param room
 * @returns whether the user can invite new members to the room
 */
export function canInviteTo(room: Room): boolean {
    const client = room.client;
    const canInvite =
        !!room.canInvite(client.getSafeUserId()) || !!(room.isSpaceRoom() && room.getJoinRule() === JoinRule.Public);

    return canInvite && room.getMyMembership() === KnownMembership.Join && shouldShowComponent(UIComponent.InviteUsers);
}
