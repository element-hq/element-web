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

import { MatrixClient, MatrixEvent, MatrixEventEvent, MatrixScheduler, Room } from "../../src";
import { eventMapperFor } from "../../src/event-mapper";
import { IStore } from "../../src/store";

describe("eventMapperFor", function () {
    let rooms: Room[] = [];

    const userId = "@test:example.org";

    let client: MatrixClient;

    beforeEach(() => {
        client = new MatrixClient({
            baseUrl: "https://my.home.server",
            accessToken: "my.access.token",
            fetchFn: function () {} as any, // NOP
            store: {
                getRoom(roomId: string): Room | null {
                    return rooms.find((r) => r.roomId === roomId) ?? null;
                },
            } as IStore,
            scheduler: {
                setProcessFunction: jest.fn(),
            } as unknown as MatrixScheduler,
            userId: userId,
        });

        rooms = [];
    });

    afterEach(() => {
        client.stopClient();
    });

    it("should de-duplicate MatrixEvent instances by means of findEventById on the room object", async () => {
        const roomId = "!room:example.org";
        const room = new Room(roomId, client, userId);
        rooms.push(room);

        const mapper = eventMapperFor(client, {
            preventReEmit: true,
            decrypt: false,
        });

        const eventId = "$event1:server";
        const eventDefinition = {
            type: "m.room.message",
            room_id: roomId,
            sender: userId,
            content: {
                body: "body",
            },
            unsigned: {},
            event_id: eventId,
        };

        const event = mapper(eventDefinition);
        expect(event).toBeInstanceOf(MatrixEvent);

        room.addLiveEvents([event]);
        expect(room.findEventById(eventId)).toBe(event);

        const event2 = mapper(eventDefinition);
        expect(event).toBe(event2);
    });

    it("should not de-duplicate state events due to directionality of sentinel members", async () => {
        const roomId = "!room:example.org";
        const room = new Room(roomId, client, userId);
        rooms.push(room);

        const mapper = eventMapperFor(client, {
            preventReEmit: true,
            decrypt: false,
        });

        const eventId = "$event1:server";
        const eventDefinition = {
            type: "m.room.name",
            room_id: roomId,
            sender: userId,
            content: {
                name: "Room name",
            },
            unsigned: {},
            event_id: eventId,
            state_key: "",
        };

        const event = mapper(eventDefinition);
        expect(event).toBeInstanceOf(MatrixEvent);

        room.oldState.setStateEvents([event]);
        room.currentState.setStateEvents([event]);
        room.addLiveEvents([event]);
        expect(room.findEventById(eventId)).toBe(event);

        const event2 = mapper(eventDefinition);
        expect(event).not.toBe(event2);
    });

    it("should decrypt appropriately", async () => {
        const roomId = "!room:example.org";
        const room = new Room(roomId, client, userId);
        rooms.push(room);

        const eventId = "$event1:server";
        const eventDefinition = {
            type: "m.room.encrypted",
            room_id: roomId,
            sender: userId,
            content: {
                ciphertext: "",
            },
            unsigned: {},
            event_id: eventId,
        };

        const decryptEventIfNeededSpy = jest.spyOn(client, "decryptEventIfNeeded");
        decryptEventIfNeededSpy.mockResolvedValue(); // stub it out

        const mapper = eventMapperFor(client, {
            decrypt: true,
        });
        const event = mapper(eventDefinition);
        expect(event).toBeInstanceOf(MatrixEvent);
        expect(decryptEventIfNeededSpy).toHaveBeenCalledWith(event);
    });

    it("should configure re-emitter appropriately", async () => {
        const roomId = "!room:example.org";
        const room = new Room(roomId, client, userId);
        rooms.push(room);

        const eventId = "$event1:server";
        const eventDefinition = {
            type: "m.room.message",
            room_id: roomId,
            sender: userId,
            content: {
                body: "body",
            },
            unsigned: {},
            event_id: eventId,
        };

        const evListener = jest.fn();
        client.on(MatrixEventEvent.Replaced, evListener);

        const noReEmitMapper = eventMapperFor(client, {
            preventReEmit: true,
        });
        const event1 = noReEmitMapper(eventDefinition);
        expect(event1).toBeInstanceOf(MatrixEvent);
        event1.emit(MatrixEventEvent.Replaced, event1);
        expect(evListener).not.toHaveBeenCalled();

        const reEmitMapper = eventMapperFor(client, {
            preventReEmit: false,
        });
        const event2 = reEmitMapper(eventDefinition);
        expect(event2).toBeInstanceOf(MatrixEvent);
        event2.emit(MatrixEventEvent.Replaced, event2);
        expect(evListener.mock.calls[0][0]).toEqual(event2);

        expect(event1).not.toBe(event2); // the event wasn't added to a room so de-duplication wouldn't occur
    });
});
