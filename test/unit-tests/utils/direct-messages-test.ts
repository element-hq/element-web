/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { ClientEvent, type MatrixClient, Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import DMRoomMap from "../../../src/utils/DMRoomMap";
import { createTestClient } from "../../test-utils";
import { LocalRoom, LocalRoomState, LOCAL_ROOM_ID_PREFIX } from "../../../src/models/LocalRoom";
import * as dmModule from "../../../src/utils/direct-messages";
import dis from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { waitForRoomReadyAndApplyAfterCreateCallbacks } from "../../../src/utils/local-room";
import { findDMRoom } from "../../../src/utils/dm/findDMRoom";
import { createDmLocalRoom } from "../../../src/utils/dm/createDmLocalRoom";
import { startDm } from "../../../src/utils/dm/startDm";
import { type Member } from "../../../src/utils/direct-messages";
import { resolveThreePids } from "../../../src/utils/threepids";

jest.mock("../../../src/utils/rooms", () => ({
    ...(jest.requireActual("../../../src/utils/rooms") as object),
    privateShouldBeEncrypted: jest.fn(),
}));

jest.mock("../../../src/createRoom", () => ({
    ...(jest.requireActual("../../../src/createRoom") as object),
    canEncryptToAllUsers: jest.fn(),
}));

jest.mock("../../../src/utils/local-room", () => ({
    waitForRoomReadyAndApplyAfterCreateCallbacks: jest.fn(),
}));

jest.mock("../../../src/utils/dm/findDMForUser", () => ({
    findDMForUser: jest.fn(),
}));

jest.mock("../../../src/utils/dm/findDMRoom", () => ({
    findDMRoom: jest.fn(),
}));

jest.mock("../../../src/utils/dm/createDmLocalRoom", () => ({
    createDmLocalRoom: jest.fn(),
}));

jest.mock("../../../src/utils/dm/startDm", () => ({
    startDm: jest.fn(),
}));

jest.mock("../../../src/utils/threepids", () => ({
    resolveThreePids: jest.fn().mockImplementation(async (members: Member[]) => {
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
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(mockClient);
        roomEvents = [];
        mockClient.on(ClientEvent.Room, (room: Room) => {
            roomEvents.push(room);
        });

        room1 = new Room("!room1:example.com", mockClient, userId1);
        room1.getMyMembership = () => KnownMembership.Join;

        localRoom = new LocalRoom(LOCAL_ROOM_ID_PREFIX + "test", mockClient, userId1);

        dmRoomMap = {
            getDMRoomForIdentifiers: jest.fn(),
            getDMRoomsForUserId: jest.fn(),
        } as unknown as DMRoomMap;
        jest.spyOn(DMRoomMap, "shared").mockReturnValue(dmRoomMap);
        jest.spyOn(dis, "dispatch");
        jest.spyOn(logger, "warn");

        jest.useFakeTimers();
        jest.setSystemTime(new Date(2022, 7, 4, 11, 12, 30, 42));
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe("startDmOnFirstMessage", () => {
        describe("if no room exists", () => {
            beforeEach(() => {
                mocked(findDMRoom).mockReturnValue(null);
            });

            it("should create a local room and dispatch a view room event", async () => {
                mocked(createDmLocalRoom).mockResolvedValue(localRoom);
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
                mocked(resolveThreePids).mockRejectedValue(error);

                mocked(createDmLocalRoom).mockResolvedValue(localRoom);
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
                mocked(findDMRoom).mockReturnValue(room1);
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
                mocked(startDm).mockRejectedValue(true);
            });

            it("should set the room state to error", async () => {
                await dmModule.createRoomFromLocalRoom(mockClient, localRoom);
                expect(localRoom.state).toBe(LocalRoomState.ERROR);
            });
        });

        describe("on startDm success", () => {
            beforeEach(() => {
                mocked(waitForRoomReadyAndApplyAfterCreateCallbacks).mockResolvedValue(room1.roomId);
                mocked(startDm).mockResolvedValue(room1.roomId);
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
