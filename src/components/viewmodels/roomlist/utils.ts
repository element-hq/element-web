/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type Room, KnownMembership, EventTimeline, EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";

import { isKnockDenied } from "../../../utils/membership";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { showCreateNewRoom } from "../../../utils/space";
import dispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";

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

/**
 * Check if the user has access to the notification menu.
 * @param room
 * @param isGuest
 * @param isArchived
 */
export function hasAccessToNotificationMenu(room: Room, isGuest: boolean, isArchived: boolean): boolean {
    return !isGuest && !isArchived && hasAccessToOptionsMenu(room);
}

/**
 * Create a room
 * @param space - The space to create the room in
 */
export async function createRoom(space?: Room | null): Promise<void> {
    if (space) {
        await showCreateNewRoom(space);
    } else {
        dispatcher.fire(Action.CreateRoom);
    }
}

/**
 * Check if the user has the rights to create a room in the given space
 * If the space is not provided, it will check if the user has the rights to create a room in general
 * @param matrixClient
 * @param space
 */
export function hasCreateRoomRights(matrixClient: MatrixClient, space?: Room | null): boolean {
    const hasUIRight = shouldShowComponent(UIComponent.CreateRooms);
    if (!space || !hasUIRight) return hasUIRight;

    return Boolean(
        space
            ?.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.maySendStateEvent(EventType.RoomAvatar, matrixClient.getSafeUserId()),
    );
}
