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

import { EventType, MatrixClient, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { JSONEventFactory, pickFactory } from "../../src/events/EventTileFactory";
import { VoiceBroadcastChunkEventType } from "../../src/voice-broadcast";
import { createTestClient, mkEvent } from "../test-utils";

const roomId = "!room:example.com";

describe("pickFactory", () => {
    let voiceBroadcastChunkEvent: MatrixEvent;
    let audioMessageEvent: MatrixEvent;
    let client: MatrixClient;

    beforeAll(() => {
        client = createTestClient();
        voiceBroadcastChunkEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId(),
            room: roomId,
            content: {
                msgtype: MsgType.Audio,
                [VoiceBroadcastChunkEventType]: {},
            },
        });
        audioMessageEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId(),
            room: roomId,
            content: {
                msgtype: MsgType.Audio,
            },
        });
    });

    it("should return JSONEventFactory for a no-op m.room.power_levels event", () => {
        const event = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            state_key: "",
            content: {},
            sender: client.getUserId(),
            room_id: roomId,
        });
        expect(pickFactory(event, client, true)).toBe(JSONEventFactory);
    });

    describe("when showing hidden events", () => {
        it("should return a function for a voice broadcast event", () => {
            expect(pickFactory(voiceBroadcastChunkEvent, client, true)).toBeInstanceOf(Function);
        });

        it("should return a function for an audio message event", () => {
            expect(pickFactory(audioMessageEvent, client, true)).toBeInstanceOf(Function);
        });
    });

    describe("when not showing hidden events", () => {
        it("should return undefined for a voice broadcast event", () => {
            expect(pickFactory(voiceBroadcastChunkEvent, client, false)).toBeUndefined();
        });

        it("should return a function for an audio message event", () => {
            expect(pickFactory(audioMessageEvent, client, false)).toBeInstanceOf(Function);
        });
    });
});
