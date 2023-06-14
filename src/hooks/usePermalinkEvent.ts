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
import { useEffect, useState } from "react";

import { PillType } from "../components/views/elements/Pill";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { PermalinkParts } from "../utils/permalinks/PermalinkConstructor";

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
                const eventData = await MatrixClientPeg.get().fetchRoomEvent(
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
