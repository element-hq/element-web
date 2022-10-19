/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "..";

interface Result {
    hasBroadcast: boolean;
    startedByUser: boolean;
}

/**
 * Finds out whether there is a live broadcast in a room.
 * Also returns if the user started the broadcast (if any).
 */
export const hasRoomLiveVoiceBroadcast = (room: Room, userId: string): Result => {
    let hasBroadcast = false;
    let startedByUser = false;

    const stateEvents = room.currentState.getStateEvents(VoiceBroadcastInfoEventType);
    stateEvents.forEach((event: MatrixEvent) => {
        const state = event.getContent()?.state;

        if (state && state !== VoiceBroadcastInfoState.Stopped) {
            hasBroadcast = true;

            // state key = sender's MXID
            if (event.getStateKey() === userId) {
                startedByUser = true;
                // break here, because more than true / true is not possible
                return false;
            }
        }
    });

    return {
        hasBroadcast,
        startedByUser,
    };
};
