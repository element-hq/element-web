/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ClientEvent, type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import { createTestClient } from "test-utils";

import DMRoomMap from "./DMRoomMap";
import { LocalRoom, LocalRoomState, LOCAL_ROOM_ID_PREFIX } from "../models/LocalRoom";
import * as dmModule from "./direct-messages";
import dis from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { waitForRoomReadyAndApplyAfterCreateCallbacks } from "./local-room";
import { findDMRoom } from "./dm/findDMRoom";
import { createDmLocalRoom } from "./dm/createDmLocalRoom";
import { startDm } from "./dm/startDm";
import { type Member } from "./direct-messages";
import { resolveThreePids } from "./threepids";

vi.mock("./rooms", async () => ({
    ...(await vi.importActual("./rooms")),
    privateShouldBeEncrypted: vi.fn(),
}));

vi.mock("../createRoom", async () => ({
    ...(await vi.importActual("../createRoom")),
    canEncryptToAllUsers: vi.fn(),
}));

vi.mock("./local-room", () => ({
    waitForRoomReadyAndApplyAfterCreateCallbacks: vi.fn(),
}));

vi.mock("./dm/findDMForUser", () => ({
    findDMForUser: vi.fn(),
}));

vi.mock("./dm/findDMRoom", () => ({
    findDMRoom: vi.fn(),
}));

vi.mock("./dm/createDmLocalRoom", () => ({
    createDmLocalRoom: vi.fn(),
}));

vi.mock("./dm/startDm", () => ({
    startDm: vi.fn(),
}));

vi.mock("./threepids", () => ({
    resolveThreePids: vi.fn().mockImplementation(async (members: Member[]) => {
        return members;
    }),
}));

describe("direct-messages", () => {
    const userId1 = "@user1:example.com";
    const member1 = new dmModule.DirectoryMember({ user_id: userId1 });
    let room1: Room;
    let localRoom: LocalRoom;
    let dmRoomMap: DMRoomMap;
    let mockClient: MatrixClient;
    let roomEvents: Room[];

    beforeEach(() => {
        mockClient = createTestClient();
        vi.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        roomEvents = [];
        mockClient.on(ClientEvent.Room, (room: Room) => {
            roomEvents.push(room);
        });

        room1 = new Room("!room1:example.com", mockClient, userId1);
        room1.getMyMembership = () => KnownMembership.Join;

        localRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", mockClient, userId1);

        dmRoomMap = {
            getDMRoomForIdentifiers: vi.fn(),
            getDMRoomsForUserId: vi.fn(),
        } as unknown as DMRoomMap;
        vi.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        vi.spyOn(dis, "dispatch");
        vi.spyOn(logger, "warn");

        vi.useFakeTimers();
        vi.setSystemTime(new Date(2022, 7, 4, 11, 12, 30, 42));
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe("startDmOnFirstMessage", () => {
        describe("if no room exists", () => {
            beforeEach(() => {
                vi.mocked(findDMRoom).mockReturnValue(null);
            });

            it("should create a local room and dispatch a view room event", async () => {
                vi.mocked(createDmLocalRoom).mockResolvedValue(localRoom);
                const members = [member1];
                const roomId = await dmModule.startDmOnFirstMessage(mockClient, members);
                expect(roomId).toBe(localRoom.roomId);
                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewRoom,
                    room_id: roomId,
                    joining: false,
                    targets: [member1],
                });

                // assert, that startDmOnFirstMessage tries to resolve 3rd-party IDs
                expect(resolveThreePids).toHaveBeenCalledWith(members, mockClient);
            });

            it("should work when resolveThreePids raises an error", async () => {
                const error = new Error("error 4711");
                vi.mocked(resolveThreePids).mockRejectedValue(error);

                vi.mocked(createDmLocalRoom).mockResolvedValue(localRoom);
                const members = [member1];
                const roomId = await dmModule.startDmOnFirstMessage(mockClient, members);
                expect(roomId).toBe(localRoom.roomId);

                // ensure that startDmOnFirstMessage tries to resolve 3rd-party IDs
                expect(resolveThreePids).toHaveBeenCalledWith(members, mockClient);

                // ensure that the error is logged
                expect(logger.warn).toHaveBeenCalledWith("Error resolving 3rd-party members", error);
            });
        });

        describe("if a room exists", () => {
            beforeEach(() => {
                vi.mocked(findDMRoom).mockReturnValue(room1);
            });

            it("should return the room and dispatch a view room event", async () => {
                const roomId = await dmModule.startDmOnFirstMessage(mockClient, [member1]);
                expect(roomId).toBe(room1.roomId);
                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewRoom,
                    room_id: room1.roomId,
                    should_peek: false,
                    joining: false,
                    metricsTrigger: "MessageUser",
                });
            });
        });
    });

    describe("createRoomFromLocalRoom", () => {
        [LocalRoomState.CREATING, LocalRoomState.CREATED, LocalRoomState.ERROR].forEach((state: LocalRoomState) => {
            it(`should do nothing for room in state ${state}`, async () => {
                localRoom.state = state;
                await dmModule.createRoomFromLocalRoom(mockClient, localRoom);
                expect(localRoom.state).toBe(state);
                expect(startDm).not.toHaveBeenCalled();
            });
        });

        describe("on startDm error", () => {
            beforeEach(() => {
                vi.mocked(startDm).mockRejectedValue(true);
            });

            it("should set the room state to error", async () => {
                await dmModule.createRoomFromLocalRoom(mockClient, localRoom);
                expect(localRoom.state).toBe(LocalRoomState.ERROR);
            });
        });

        describe("on startDm success", () => {
            beforeEach(() => {
                vi.mocked(waitForRoomReadyAndApplyAfterCreateCallbacks).mockResolvedValue(room1.roomId);
                vi.mocked(startDm).mockResolvedValue(room1.roomId);
            });

            it("should set the room into creating state and call waitForRoomReadyAndApplyAfterCreateCallbacks", async () => {
                const result = await dmModule.createRoomFromLocalRoom(mockClient, localRoom);
                expect(result).toBe(room1.roomId);
                expect(localRoom.state).toBe(LocalRoomState.CREATING);
                expect(waitForRoomReadyAndApplyAfterCreateCallbacks).toHaveBeenCalledWith(
                    mockClient,
                    localRoom,
                    room1.roomId,
                );
            });
        });
    });
});
