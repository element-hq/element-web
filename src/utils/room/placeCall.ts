/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
    if (platformCallType == PlatformCallType.LegacyCall || platformCallType == PlatformCallType.JitsiCall) {
        await LegacyCallHandler.instance.placeCall(room.roomId, callType);
    } else if (platformCallType == PlatformCallType.ElementCall) {
        defaultDispatcher.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: room.roomId,
            view_call: true,
            skipLobby,
            metricsTrigger: undefined,
        });
    }
};
