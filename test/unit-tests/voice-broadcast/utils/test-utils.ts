/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { Optional } from "matrix-events-sdk";
import { EventType, IContent, MatrixEvent, MsgType, RelationType, Room, RoomMember } from "matrix-js-sdk/src/matrix";

import { SdkContextClass } from "../../../../src/contexts/SDKContext";
import {
    VoiceBroadcastPlayback,
    VoiceBroadcastPreRecording,
    VoiceBroadcastRecording,
} from "../../../../src/voice-broadcast";
import {
    VoiceBroadcastChunkEventType,
    VoiceBroadcastInfoEventType,
    VoiceBroadcastInfoState,
} from "../../../../src/voice-broadcast/types";
import { mkEvent } from "../../../test-utils";

// timestamp incremented on each call to prevent duplicate timestamp
let timestamp = new Date().getTime();

export const mkVoiceBroadcastInfoStateEvent = (
    roomId: Optional<string>,
    state: Optional<VoiceBroadcastInfoState>,
    senderId: Optional<string>,
    senderDeviceId: Optional<string>,
    startedInfoEvent?: MatrixEvent,
    lastChunkSequence?: number,
): MatrixEvent => {
    const relationContent: IContent = {};

    if (startedInfoEvent) {
        relationContent["m.relates_to"] = {
            event_id: startedInfoEvent.getId(),
            rel_type: "m.reference",
        };
    }

    const lastChunkSequenceContent = lastChunkSequence ? { last_chunk_sequence: lastChunkSequence } : {};

    return mkEvent({
        event: true,
        // @ts-ignore allow everything here for edge test cases
        room: roomId,
        // @ts-ignore allow everything here for edge test cases
        user: senderId,
        type: VoiceBroadcastInfoEventType,
        // @ts-ignore allow everything here for edge test cases
        skey: senderId,
        content: {
            state,
            device_id: senderDeviceId,
            ...relationContent,
            ...lastChunkSequenceContent,
        },
        ts: timestamp++,
    });
};

export const mkVoiceBroadcastChunkEvent = (
    infoEventId: string,
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
            ["m.relates_to"]: {
                rel_type: RelationType.Reference,
                event_id: infoEventId,
            },
        },
        ts: timestamp,
    });
};

export const mkVoiceBroadcastPlayback = (stores: SdkContextClass): VoiceBroadcastPlayback => {
    const infoEvent = mkVoiceBroadcastInfoStateEvent(
        "!room:example.com",
        VoiceBroadcastInfoState.Started,
        "@user:example.com",
        "ASD123",
    );
    return new VoiceBroadcastPlayback(infoEvent, stores.client!, stores.voiceBroadcastRecordingsStore);
};

export const mkVoiceBroadcastRecording = (stores: SdkContextClass): VoiceBroadcastRecording => {
    const infoEvent = mkVoiceBroadcastInfoStateEvent(
        "!room:example.com",
        VoiceBroadcastInfoState.Started,
        "@user:example.com",
        "ASD123",
    );
    return new VoiceBroadcastRecording(infoEvent, stores.client!);
};

export const mkVoiceBroadcastPreRecording = (stores: SdkContextClass): VoiceBroadcastPreRecording => {
    const roomId = "!room:example.com";
    const userId = "@user:example.com";
    const room = new Room(roomId, stores.client!, userId);
    const roomMember = new RoomMember(roomId, userId);
    return new VoiceBroadcastPreRecording(
        room,
        roomMember,
        stores.client!,
        stores.voiceBroadcastPlaybacksStore,
        stores.voiceBroadcastRecordingsStore,
    );
};
