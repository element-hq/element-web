/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { useEffect, useState } from "react";

import { PillType } from "../components/views/elements/Pill";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { type PermalinkParts } from "../utils/permalinks/PermalinkConstructor";

/**
 * Tries to find the initial event.
 * If the event should not be looked up or there is no target room it returns null.
 * Otherwise it tries to get the event from the target room.
 *
 * @param shouldLookUpEvent - whether the parmalink event should be looked up
 * @param Room | null targetRoom - target room of the permalink
 * @param parseResult - permalink parse result
 * @returns The event if found or null if it should not be looked up or was not found.
 */
const determineInitialEvent = (
    shouldLookUpEvent: boolean,
    targetRoom: Room | null,
    parseResult: PermalinkParts | null,
): MatrixEvent | null => {
    if (!shouldLookUpEvent || !targetRoom || !parseResult?.eventId) return null;

    return targetRoom.findEventById(parseResult.eventId) || null;
};

/**
 * Hook to get a permalink target event
 *
 * @param type - Permalink type
 * @param parseResult - Permalink parse result
 * @param targetRoom - Target room of the permalink {@link ./usePermalinkTargetRoom.ts}
 * @returns The permalink event if it targets an event and it can be loaded.
 *          Else null.
 */
export const usePermalinkEvent = (
    type: PillType | null,
    parseResult: PermalinkParts | null,
    targetRoom: Room | null,
): MatrixEvent | null => {
    // Event permalinks require to know the event.
    // If it cannot be initially determined, it will be looked up later by a memo hook.
    const shouldLookUpEvent =
        !!type &&
        !!parseResult?.roomIdOrAlias &&
        !!parseResult?.eventId &&
        [PillType.EventInSameRoom, PillType.EventInOtherRoom].includes(type);
    const eventId = parseResult?.eventId;
    const eventInRoom = determineInitialEvent(shouldLookUpEvent, targetRoom, parseResult);
    const [event, setEvent] = useState<MatrixEvent | null>(eventInRoom);

    useEffect(() => {
        if (!shouldLookUpEvent || !eventId || event || !parseResult?.roomIdOrAlias || !parseResult.eventId) {
            // nothing to do here
            return;
        }

        const fetchRoomEvent = async (): Promise<void> => {
            try {
                const eventData = await MatrixClientPeg.safeGet().fetchRoomEvent(
                    parseResult.roomIdOrAlias!,
                    parseResult.eventId!,
                );
                setEvent(new MatrixEvent(eventData));
            } catch {}
        };

        fetchRoomEvent();
    }, [event, eventId, parseResult?.eventId, parseResult?.roomIdOrAlias, shouldLookUpEvent]);

    return event;
};
