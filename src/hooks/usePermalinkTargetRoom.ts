/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { useEffect, useState } from "react";

import { PillType } from "../components/views/elements/Pill";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { type PermalinkParts } from "../utils/permalinks/PermalinkConstructor";

/**
 * Tries to determine the initial room.
 * Initial here means it should be possible to load the room without sending API requests.
 * For an @room or a user mention it is the permalinkRoom.
 * If the parse result contains a room Id or alias try to find it with {@link findRoom}.
 * Otherwise returns null.
 *
 * @param type - Pill type
 * @param permalinkRoom - Room in which the permalink is displayed.
 * @param parseResult - Permalink parser result
 * @returns Initial room or null if it cannot be determined.
 */
const determineInitialRoom = (
    type: PillType | null,
    parseResult: PermalinkParts | null,
    permalinkRoom: Room | undefined,
): Room | null => {
    if (type === PillType.AtRoomMention && permalinkRoom) return permalinkRoom;

    if (type === PillType.UserMention && permalinkRoom) {
        return permalinkRoom;
    }

    if (parseResult?.roomIdOrAlias) {
        const room = findRoom(parseResult.roomIdOrAlias);
        if (room) return room;
    }

    return null;
};

/**
 * Tries to find a room by room Id or searching all rooms for an alias.
 *
 * @param roomIdOrAlias - Id or alias of the room to find.
 * @returns Room if found, else null.
 */
const findRoom = (roomIdOrAlias: string): Room | null => {
    const client = MatrixClientPeg.safeGet();

    return roomIdOrAlias[0] === "#"
        ? (client.getRooms().find((r) => {
              return r.getCanonicalAlias() === roomIdOrAlias || r.getAltAliases().includes(roomIdOrAlias);
          }) ?? null)
        : client.getRoom(roomIdOrAlias);
};

/**
 * Hook to get the permalink target room:
 *
 * @param type - Permalink type
 * @param parseResult - Permalink parse result
 * @param permalinkRoom - Room in which the permalink is rendered
 * @returns Returns the target room:
 *          - The permalinkRoom for an @room or user mention
 *          - The room of the parse result for a room mention
 *          - The room of the event for an event permalink
 *          - Null in other cases or if the room cannot be found
 */
export const usePermalinkTargetRoom = (
    type: PillType | null,
    parseResult: PermalinkParts | null,
    permalinkRoom: Room | undefined,
): Room | null => {
    // The listed permalink types require a room.
    // If it cannot be initially determined, it will be looked up later by a memo hook.
    const shouldLookUpRoom =
        type && [PillType.RoomMention, PillType.EventInSameRoom, PillType.EventInOtherRoom, "space"].includes(type);
    const initialRoom = determineInitialRoom(type, parseResult, permalinkRoom);
    const [targetRoom, setTargetRoom] = useState<Room | null>(initialRoom);

    useEffect(() => {
        if (shouldLookUpRoom && !targetRoom && parseResult?.roomIdOrAlias) {
            const newRoom = findRoom(parseResult.roomIdOrAlias);
            setTargetRoom(newRoom);
        }
    }, [parseResult?.roomIdOrAlias, shouldLookUpRoom, targetRoom]);

    return targetRoom;
};
