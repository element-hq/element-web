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

import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import {
    VoiceBroadcastChunkEventType,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
} from "../../../src/voice-broadcast";
import { mkEvent } from "../../test-utils";

export const mkVoiceBroadcastInfoStateEvent = (
    roomId: string,
    state: VoiceBroadcastInfoState,
    senderId: string,
    senderDeviceId: string,
    startedInfoEvent?: MatrixEvent,
): MatrixEvent => {
    const relationContent = {};

    if (startedInfoEvent) {
        relationContent["m.relates_to"] = {
            event_id: startedInfoEvent.getId(),
            rel_type: "m.reference",
        };
    }

    return mkEvent({
        event: true,
        room: roomId,
        user: senderId,
        type: VoiceBroadcastInfoEventType,
        skey: senderId,
        content: {
            state,
            device_id: senderDeviceId,
            ...relationContent,
        },
    });
};

export const mkVoiceBroadcastChunkEvent = (
    userId: string,
    roomId: string,
    duration: number,
    sequence?: number,
    timestamp?: number,
): MatrixEvent => {
    return mkEvent({
        event: true,
        user: userId,
        room: roomId,
        type: EventType.RoomMessage,
        content: {
            msgtype: MsgType.Audio,
            ["org.matrix.msc1767.audio"]: {
                duration,
            },
            info: {
                duration,
            },
            [VoiceBroadcastChunkEventType]: {
                ...(sequence ? { sequence } : {}),
            },
        },
        ts: timestamp,
    });
};
