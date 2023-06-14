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

import { Room } from "matrix-js-sdk/src/matrix";
import { useEffect, useState } from "react";

import { PillType } from "../components/views/elements/Pill";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { PermalinkParts } from "../utils/permalinks/PermalinkConstructor";

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
    const client = MatrixClientPeg.get();

    return roomIdOrAlias[0] === "#"
        ? client.getRooms().find((r) => {
              return r.getCanonicalAlias() === roomIdOrAlias || r.getAltAliases().includes(roomIdOrAlias);
          }) ?? null
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
