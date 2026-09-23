/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { createTestClient } from "test-utils";

import { LocalRoom, LocalRoomState, LOCAL_ROOM_ID_PREFIX } from "../models/LocalRoom";
import * as localRoomModule from "./local-room";
import defaultDispatcher from "../dispatcher/dispatcher";
import { isRoomReady } from "./localRoom/isRoomReady";

vi.mock("./localRoom/isRoomReady", () => ({
    isRoomReady: vi.fn(),
}));

describe("local-room", () => {
    const userId1 = "@user1:example.com";
    let room1: Room;
    let localRoom: LocalRoom;
    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();
        room1 = new Room("!room1:example.com", client, userId1);
        room1.getMyMembership = () => KnownMembership.Join;
        localRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", client, "@test:example.com");
        vi.mocked(client.getRoom).mockImplementation((roomId: string | undefined) => {
            if (roomId === localRoom.roomId) {
                return localRoom;
            }
            return null;
        });
    });

    describe("doMaybeLocalRoomAction", () => {
        let callback: Mock;

        beforeEach(() => {
            callback = vi.fn();
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
                vi.spyOn(defaultDispatcher, "dispatch");
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
                    callback(localRoom.actualRoomId!);
                });
                await expect(prom).resolves.toBeUndefined();
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
            vi.useFakeTimers();
        });

        describe("for an immediate ready room", () => {
            beforeEach(() => {
                vi.mocked(isRoomReady).mockReturnValue(true);
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
                vi.mocked(isRoomReady).mockReturnValue(false);
            });

            it("should invoke the callbacks, set the room state to created and return the actual room id", async () => {
                const prom = localRoomModule.waitForRoomReadyAndApplyAfterCreateCallbacks(
                    client,
                    localRoom,
                    room1.roomId,
                );
                vi.advanceTimersByTime(5000);
                const roomId = await prom;
                expect(localRoom.state).toBe(LocalRoomState.CREATED);
                expect(localRoomCallbackRoomId).toBe(room1.roomId);
                expect(roomId).toBe(room1.roomId);
                expect(vi.getTimerCount()).toBe(0);
            });
        });

        describe("for a room that is ready after a while", () => {
            beforeEach(() => {
                vi.mocked(isRoomReady).mockReturnValue(false);
            });

            it("should invoke the callbacks, set the room state to created and return the actual room id", async () => {
                const prom = localRoomModule.waitForRoomReadyAndApplyAfterCreateCallbacks(
                    client,
                    localRoom,
                    room1.roomId,
                );
                vi.mocked(isRoomReady).mockReturnValue(true);
                vi.advanceTimersByTime(500);
                const roomId = await prom;
                expect(localRoom.state).toBe(LocalRoomState.CREATED);
                expect(localRoomCallbackRoomId).toBe(room1.roomId);
                expect(roomId).toBe(room1.roomId);
                expect(vi.getTimerCount()).toBe(0);
            });
        });
    });
});
