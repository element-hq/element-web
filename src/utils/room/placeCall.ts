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

import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { Room } from "matrix-js-sdk/src/matrix";

import LegacyCallHandler from "../../LegacyCallHandler";
import { PlatformCallType } from "../../hooks/room/useRoomCall";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../../dispatcher/actions";

/**
 * Helper to place a call in a room that works with all the legacy modes
 * @param room the room to place the call in
 * @param callType the type of call
 * @param platformCallType the platform to pass the call on
 */
export const placeCall = async (
    room: Room,
    callType: CallType,
    platformCallType: PlatformCallType,
    skipLobby: boolean,
): Promise<void> => {
    switch (platformCallType) {
        case "legacy_or_jitsi":
            await LegacyCallHandler.instance.placeCall(room.roomId, callType);
            break;
        // TODO: Remove the jitsi_or_element_call case and
        // use the commented code below
        case "element_call":
        case "jitsi_or_element_call":
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
                metricsTrigger: undefined,
                skipLobby,
            });
            break;

        // case "jitsi_or_element_call":
        // TODO: Open dropdown menu to choice between
        // EC and Jitsi. Waiting on Compound's dropdown
        // component
        // break;
    }
};
