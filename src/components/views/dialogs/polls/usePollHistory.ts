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

import { useEffect, useState } from "react";
import { Poll, PollEvent } from "matrix-js-sdk/src/matrix";
import { MatrixClient } from "matrix-js-sdk/src/client";

import { useEventEmitterState } from "../../../../hooks/useEventEmitter";

/**
 * Get poll instances from a room
 * Updates to include new polls
 * @param roomId - id of room to retrieve polls for
 * @param matrixClient - client
 * @returns {Map<string, Poll>} - Map of Poll instances
 */
export const usePolls = (
    roomId: string,
    matrixClient: MatrixClient,
): {
    polls: Map<string, Poll>;
} => {
    const room = matrixClient.getRoom(roomId);

    if (!room) {
        throw new Error("Cannot find room");
    }

    // copy room.polls map so changes can be detected
    const polls = useEventEmitterState(room, PollEvent.New, () => new Map<string, Poll>(room.polls));

    return { polls };
};

/**
 * Get all poll instances from a room
 * Fetch their responses (using cached poll responses)
 * Updates on:
 * - new polls added to room
 * - new responses added to polls
 * - changes to poll ended state
 * @param roomId - id of room to retrieve polls for
 * @param matrixClient - client
 * @returns {Map<string, Poll>} - Map of Poll instances
 */
export const usePollsWithRelations = (
    roomId: string,
    matrixClient: MatrixClient,
): {
    polls: Map<string, Poll>;
} => {
    const { polls } = usePolls(roomId, matrixClient);
    const [pollsWithRelations, setPollsWithRelations] = useState<Map<string, Poll>>(polls);

    useEffect(() => {
        const onPollUpdate = async (): Promise<void> => {
            // trigger rerender by creating a new poll map
            setPollsWithRelations(new Map(polls));
        };
        if (polls) {
            for (const poll of polls.values()) {
                // listen to changes in responses and end state
                poll.on(PollEvent.End, onPollUpdate);
                poll.on(PollEvent.Responses, onPollUpdate);
                // trigger request to get all responses
                // if they are not already in cache
                poll.getResponses();
            }
            setPollsWithRelations(polls);
        }
        // unsubscribe
        return () => {
            if (polls) {
                for (const poll of polls.values()) {
                    poll.off(PollEvent.End, onPollUpdate);
                    poll.off(PollEvent.Responses, onPollUpdate);
                }
            }
        };
    }, [polls, setPollsWithRelations]);

    return { polls: pollsWithRelations };
};
