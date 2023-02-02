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

import { M_POLL_START } from "matrix-js-sdk/src/@types/polls";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { MatrixClient } from "matrix-js-sdk/src/client";

/**
 * Get poll start events in a rooms live timeline
 * @param roomId - id of room to retrieve polls for
 * @param matrixClient - client
 * @returns {MatrixEvent[]} - array fo poll start events
 */
export const getPolls = (roomId: string, matrixClient: MatrixClient): MatrixEvent[] => {
    const room = matrixClient.getRoom(roomId);

    if (!room) {
        throw new Error("Cannot find room");
    }

    // @TODO(kerrya) poll history will be actively fetched in PSG-1043
    // for now, just display polls that are in the current timeline
    const timelineEvents = room.getLiveTimeline().getEvents();
    const pollStartEvents = timelineEvents.filter((event) => M_POLL_START.matches(event.getType()));

    return pollStartEvents;
};
