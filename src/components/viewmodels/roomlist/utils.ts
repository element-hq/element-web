/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room, KnownMembership } from "matrix-js-sdk/src/matrix";

import { isKnockDenied } from "../../../utils/membership";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";

/**
 * Check if the user has access to the options menu.
 * @param room
 */
export function hasAccessToOptionsMenu(room: Room): boolean {
    return (
        room.getMyMembership() === KnownMembership.Invite ||
        (room.getMyMembership() !== KnownMembership.Knock &&
            !isKnockDenied(room) &&
            shouldShowComponent(UIComponent.RoomOptionsMenu))
    );
}
