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

import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { retrieveStartedInfoEvent, VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "..";
import { asyncEvery } from "../../utils/arrays";

interface Result {
    // whether there is a live broadcast in the room
    hasBroadcast: boolean;
    // info event of any live broadcast in the room
    infoEvent: MatrixEvent | null;
    // whether the broadcast was started by the user
    startedByUser: boolean;
}

export const hasRoomLiveVoiceBroadcast = async (client: MatrixClient, room: Room, userId?: string): Promise<Result> => {
    let hasBroadcast = false;
    let startedByUser = false;
    let infoEvent: MatrixEvent | null = null;

    const stateEvents = room.currentState.getStateEvents(VoiceBroadcastInfoEventType);
    await asyncEvery(stateEvents, async (event: MatrixEvent) => {
        const state = event.getContent()?.state;

        if (state && state !== VoiceBroadcastInfoState.Stopped) {
            const startEvent = await retrieveStartedInfoEvent(event, client);

            // skip if started voice broadcast event is redacted
            if (startEvent?.isRedacted()) return true;

            hasBroadcast = true;
            infoEvent = startEvent;

            // state key = sender's MXID
            if (event.getStateKey() === userId) {
                startedByUser = true;
                // break here, because more than true / true is not possible
                return false;
            }
        }

        return true;
    });

    return {
        hasBroadcast,
        infoEvent,
        startedByUser,
    };
};
