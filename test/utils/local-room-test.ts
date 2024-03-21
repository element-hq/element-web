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
import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import { LocalRoom, LocalRoomState, LOCAL_ROOM_ID_PREFIX } from "../../src/models/LocalRoom";
import * as localRoomModule from "../../src/utils/local-room";
import defaultDispatcher from "../../src/dispatcher/dispatcher";
import { createTestClient } from "../test-utils";
import { isRoomReady } from "../../src/utils/localRoom/isRoomReady";

jest.mock("../../src/utils/localRoom/isRoomReady", () => ({
    isRoomReady: jest.fn(),
}));

describe("local-room", () => {
    const userId1 = "@user1:example.com";
    let room1: Room;
    let localRoom: LocalRoom;
    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();
        room1 = new Room("!room1:example.com", client, userId1);
        room1.getMyMembership = () => "join";
        localRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", client, "@test:example.com");
        mocked(client.getRoom).mockImplementation((roomId: string) => {
            if (roomId === localRoom.roomId) {
                return localRoom;
            }
            return null;
        });
    });

    describe("doMaybeLocalRoomAction", () => {
        let callback: jest.Mock;

        beforeEach(() => {
            callback = jest.fn();
            callback.mockReturnValue(Promise.resolve());
            localRoom.actualRoomId = "@new:example.com";
        });

        it("should invoke the callback for a non-local room", () => {
            localRoomModule.doMaybeLocalRoomAction("!room:example.com", callback, client);
            expect(callback).toHaveBeenCalled();
        });

        it("should invoke the callback with the new room ID for a created room", () => {
            localRoom.state = LocalRoomState.CREATED;
            localRoomModule.doMaybeLocalRoomAction(localRoom.roomId, callback, client);
            expect(callback).toHaveBeenCalledWith(localRoom.actualRoomId);
        });

        describe("for a local room", () => {
            let prom: Promise<unknown>;

            beforeEach(() => {
                jest.spyOn(defaultDispatcher, "dispatch");
                prom = localRoomModule.doMaybeLocalRoomAction(localRoom.roomId, callback, client);
            });

            it("dispatch a local_room_event", () => {
                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                    action: "local_room_event",
                    roomId: localRoom.roomId,
                });
            });

            it("should resolve the promise after invoking the callback", async () => {
                localRoom.afterCreateCallbacks.forEach((callback) => {
                    callback(localRoom.actualRoomId);
                });
                await prom;
            });
        });
    });

    describe("waitForRoomReadyAndApplyAfterCreateCallbacks", () => {
        let localRoomCallbackRoomId: string;

        beforeEach(() => {
            localRoom.actualRoomId = room1.roomId;
            localRoom.afterCreateCallbacks.push((roomId: string) => {
                localRoomCallbackRoomId = roomId;
                return Promise.resolve();
            });
            jest.useFakeTimers();
        });

        describe("for an immediate ready room", () => {
            beforeEach(() => {
                mocked(isRoomReady).mockReturnValue(true);
            });

            it("should invoke the callbacks, set the room state to created and return the actual room id", async () => {
                const result = await localRoomModule.waitForRoomReadyAndApplyAfterCreateCallbacks(
                    client,
                    localRoom,
                    room1.roomId,
                );
                expect(localRoom.state).toBe(LocalRoomState.CREATED);
                expect(localRoomCallbackRoomId).toBe(room1.roomId);
                expect(result).toBe(room1.roomId);
            });
        });

        describe("for a room running into the create timeout", () => {
            beforeEach(() => {
                mocked(isRoomReady).mockReturnValue(false);
            });

            it("should invoke the callbacks, set the room state to created and return the actual room id", async () => {
                const prom = localRoomModule.waitForRoomReadyAndApplyAfterCreateCallbacks(
                    client,
                    localRoom,
                    room1.roomId,
                );
                jest.advanceTimersByTime(5000);
                const roomId = await prom;
                expect(localRoom.state).toBe(LocalRoomState.CREATED);
                expect(localRoomCallbackRoomId).toBe(room1.roomId);
                expect(roomId).toBe(room1.roomId);
                expect(jest.getTimerCount()).toBe(0);
            });
        });

        describe("for a room that is ready after a while", () => {
            beforeEach(() => {
                mocked(isRoomReady).mockReturnValue(false);
            });

            it("should invoke the callbacks, set the room state to created and return the actual room id", async () => {
                const prom = localRoomModule.waitForRoomReadyAndApplyAfterCreateCallbacks(
                    client,
                    localRoom,
                    room1.roomId,
                );
                mocked(isRoomReady).mockReturnValue(true);
                jest.advanceTimersByTime(500);
                const roomId = await prom;
                expect(localRoom.state).toBe(LocalRoomState.CREATED);
                expect(localRoomCallbackRoomId).toBe(room1.roomId);
                expect(roomId).toBe(room1.roomId);
                expect(jest.getTimerCount()).toBe(0);
            });
        });
    });
});
