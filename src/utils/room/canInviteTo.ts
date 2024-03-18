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

import { JoinRule, Room } from "matrix-js-sdk/src/matrix";
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
