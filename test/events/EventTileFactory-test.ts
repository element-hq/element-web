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

import { mocked } from "jest-mock";
import { EventType, MatrixClient, MatrixEvent, MsgType, RelationType, Room } from "matrix-js-sdk/src/matrix";

import {
    JSONEventFactory,
    MessageEventFactory,
    pickFactory,
    RoomCreateEventFactory,
    TextualEventFactory,
} from "../../src/events/EventTileFactory";
import SettingsStore from "../../src/settings/SettingsStore";
import { VoiceBroadcastChunkEventType, VoiceBroadcastInfoState } from "../../src/voice-broadcast";
import { createTestClient, mkEvent } from "../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../voice-broadcast/utils/test-utils";

const roomId = "!room:example.com";

describe("pickFactory", () => {
    let client: MatrixClient;
    let room: Room;

    let createEventWithPredecessor: MatrixEvent;
    let createEventWithoutPredecessor: MatrixEvent;
    let dynamicPredecessorEvent: MatrixEvent;

    let voiceBroadcastStartedEvent: MatrixEvent;
    let voiceBroadcastStoppedEvent: MatrixEvent;
    let voiceBroadcastChunkEvent: MatrixEvent;
    let utdEvent: MatrixEvent;
    let utdBroadcastChunkEvent: MatrixEvent;
    let audioMessageEvent: MatrixEvent;

    beforeAll(() => {
        client = createTestClient();

        room = new Room(roomId, client, client.getSafeUserId());
        mocked(client.getRoom).mockImplementation((getRoomId: string): Room | null => {
            if (getRoomId === room.roomId) return room;
            return null;
        });

        createEventWithoutPredecessor = mkEvent({
            event: true,
            type: EventType.RoomCreate,
            user: client.getUserId()!,
            room: roomId,
            content: {
                creator: client.getUserId()!,
                room_version: "9",
            },
        });
        createEventWithPredecessor = mkEvent({
            event: true,
            type: EventType.RoomCreate,
            user: client.getUserId()!,
            room: roomId,
            content: {
                creator: client.getUserId()!,
                room_version: "9",
                predecessor: {
                    room_id: "roomid1",
                    event_id: null,
                },
            },
        });
        dynamicPredecessorEvent = mkEvent({
            event: true,
            type: EventType.RoomPredecessor,
            user: client.getUserId()!,
            room: roomId,
            skey: "",
            content: {
                predecessor_room_id: "roomid2",
                last_known_event_id: null,
            },
        });
        voiceBroadcastStartedEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId()!,
            client.deviceId!,
        );
        room.addLiveEvents([voiceBroadcastStartedEvent]);
        voiceBroadcastStoppedEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Stopped,
            client.getUserId()!,
            client.deviceId!,
        );
        voiceBroadcastChunkEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId()!,
            room: roomId,
            content: {
                msgtype: MsgType.Audio,
                [VoiceBroadcastChunkEventType]: {},
            },
        });
        audioMessageEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId()!,
            room: roomId,
            content: {
                msgtype: MsgType.Audio,
            },
        });
        utdEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId()!,
            room: roomId,
            content: {
                msgtype: "m.bad.encrypted",
            },
        });
        utdBroadcastChunkEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            user: client.getUserId()!,
            room: roomId,
            content: {
                "msgtype": "m.bad.encrypted",
                "m.relates_to": {
                    rel_type: RelationType.Reference,
                    event_id: voiceBroadcastStartedEvent.getId(),
                },
            },
        });
        jest.spyOn(utdBroadcastChunkEvent, "isDecryptionFailure").mockReturnValue(true);
    });

    it("should return JSONEventFactory for a no-op m.room.power_levels event", () => {
        const event = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            state_key: "",
            content: {},
            sender: client.getUserId()!,
            room_id: roomId,
        });
        expect(pickFactory(event, client, true)).toBe(JSONEventFactory);
    });

    describe("when showing hidden events", () => {
        it("should return a JSONEventFactory for a voice broadcast event", () => {
            expect(pickFactory(voiceBroadcastChunkEvent, client, true)).toBe(JSONEventFactory);
        });

        it("should return a JSONEventFactory for a room create event without predecessor", () => {
            room.currentState.events.set(
                EventType.RoomCreate,
                new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
            );
            room.currentState.events.set(EventType.RoomPredecessor, new Map());
            expect(pickFactory(createEventWithoutPredecessor, client, true)).toBe(JSONEventFactory);
        });

        it("should return a TextualEventFactory for a voice broadcast stopped event", () => {
            expect(pickFactory(voiceBroadcastStoppedEvent, client, true)).toBe(TextualEventFactory);
        });

        it("should return a MessageEventFactory for an audio message event", () => {
            expect(pickFactory(audioMessageEvent, client, true)).toBe(MessageEventFactory);
        });

        it("should return a MessageEventFactory for a UTD broadcast chunk event", () => {
            expect(pickFactory(utdBroadcastChunkEvent, client, true)).toBe(MessageEventFactory);
        });
    });

    describe("when not showing hidden events", () => {
        describe("without dynamic predecessor support", () => {
            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue").mockReset();
            });

            it("should return undefined for a room without predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
                );
                room.currentState.events.set(EventType.RoomPredecessor, new Map());
                expect(pickFactory(createEventWithoutPredecessor, client, false)).toBeUndefined();
            });

            it("should return a RoomCreateFactory for a room with fixed predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithPredecessor.getStateKey()!, createEventWithPredecessor]]),
                );
                room.currentState.events.set(EventType.RoomPredecessor, new Map());
                expect(pickFactory(createEventWithPredecessor, client, false)).toBe(RoomCreateEventFactory);
            });

            it("should return undefined for a room with dynamic predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
                );
                room.currentState.events.set(
                    EventType.RoomPredecessor,
                    new Map([[dynamicPredecessorEvent.getStateKey()!, dynamicPredecessorEvent]]),
                );
                expect(pickFactory(createEventWithoutPredecessor, client, false)).toBeUndefined();
            });
        });

        describe("with dynamic predecessor support", () => {
            beforeEach(() => {
                jest.spyOn(SettingsStore, "getValue")
                    .mockReset()
                    .mockImplementation((settingName) => settingName === "feature_dynamic_room_predecessors");
            });

            it("should return undefined for a room without predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
                );
                room.currentState.events.set(EventType.RoomPredecessor, new Map());
                expect(pickFactory(createEventWithoutPredecessor, client, false)).toBeUndefined();
            });

            it("should return a RoomCreateFactory for a room with fixed predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithPredecessor.getStateKey()!, createEventWithPredecessor]]),
                );
                room.currentState.events.set(EventType.RoomPredecessor, new Map());
                expect(pickFactory(createEventWithPredecessor, client, false)).toBe(RoomCreateEventFactory);
            });

            it("should return a RoomCreateFactory for a room with dynamic predecessor", () => {
                room.currentState.events.set(
                    EventType.RoomCreate,
                    new Map([[createEventWithoutPredecessor.getStateKey()!, createEventWithoutPredecessor]]),
                );
                room.currentState.events.set(
                    EventType.RoomPredecessor,
                    new Map([[dynamicPredecessorEvent.getStateKey()!, dynamicPredecessorEvent]]),
                );
                expect(pickFactory(createEventWithoutPredecessor, client, false)).toBe(RoomCreateEventFactory);
            });
        });

        it("should return undefined for a voice broadcast event", () => {
            expect(pickFactory(voiceBroadcastChunkEvent, client, false)).toBeUndefined();
        });

        it("should return a TextualEventFactory for a voice broadcast stopped event", () => {
            expect(pickFactory(voiceBroadcastStoppedEvent, client, false)).toBe(TextualEventFactory);
        });

        it("should return a MessageEventFactory for an audio message event", () => {
            expect(pickFactory(audioMessageEvent, client, false)).toBe(MessageEventFactory);
        });

        it("should return a MessageEventFactory for a UTD event", () => {
            expect(pickFactory(utdEvent, client, false)).toBe(MessageEventFactory);
        });

        it("should return undefined for a UTD broadcast chunk event", () => {
            expect(pickFactory(utdBroadcastChunkEvent, client, false)).toBeUndefined();
        });
    });
});
