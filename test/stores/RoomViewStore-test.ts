/*
Copyright 2017 - 2022 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/matrix";

import { RoomViewStore } from "../../src/stores/RoomViewStore";
import { Action } from "../../src/dispatcher/actions";
import { getMockClientWithEventEmitter, untilDispatch, untilEmission } from "../test-utils";
import SettingsStore from "../../src/settings/SettingsStore";
import { SlidingSyncManager } from "../../src/SlidingSyncManager";
import { PosthogAnalytics } from "../../src/PosthogAnalytics";
import { TimelineRenderingType } from "../../src/contexts/RoomContext";
import { MatrixDispatcher } from "../../src/dispatcher/dispatcher";
import { UPDATE_EVENT } from "../../src/stores/AsyncStore";
import { ActiveRoomChangedPayload } from "../../src/dispatcher/payloads/ActiveRoomChangedPayload";
import { SpaceStoreClass } from "../../src/stores/spaces/SpaceStore";
import { TestSdkContext } from "../TestSdkContext";

// mock out the injected classes
jest.mock("../../src/PosthogAnalytics");
const MockPosthogAnalytics = <jest.Mock<PosthogAnalytics>>(<unknown>PosthogAnalytics);
jest.mock("../../src/SlidingSyncManager");
const MockSlidingSyncManager = <jest.Mock<SlidingSyncManager>>(<unknown>SlidingSyncManager);
jest.mock("../../src/stores/spaces/SpaceStore");
const MockSpaceStore = <jest.Mock<SpaceStoreClass>>(<unknown>SpaceStoreClass);

jest.mock("../../src/utils/DMRoomMap", () => {
    const mock = {
        getUserIdForRoomId: jest.fn(),
        getDMRoomsForUserId: jest.fn(),
    };

    return {
        shared: jest.fn().mockReturnValue(mock),
        sharedInstance: mock,
    };
});

describe("RoomViewStore", function () {
    const userId = "@alice:server";
    const roomId = "!randomcharacters:aser.ver";
    // we need to change the alias to ensure cache misses as the cache exists
    // through all tests.
    let alias = "#somealias2:aser.ver";
    const mockClient = getMockClientWithEventEmitter({
        joinRoom: jest.fn(),
        getRoom: jest.fn(),
        getRoomIdForAlias: jest.fn(),
        isGuest: jest.fn(),
    });
    const room = new Room(roomId, mockClient, userId);

    let roomViewStore: RoomViewStore;
    let slidingSyncManager: SlidingSyncManager;
    let dis: MatrixDispatcher;

    beforeEach(function () {
        jest.clearAllMocks();
        mockClient.credentials = { userId: userId };
        mockClient.joinRoom.mockResolvedValue(room);
        mockClient.getRoom.mockReturnValue(room);
        mockClient.isGuest.mockReturnValue(false);

        // Make the RVS to test
        dis = new MatrixDispatcher();
        slidingSyncManager = new MockSlidingSyncManager();
        const stores = new TestSdkContext();
        stores._SlidingSyncManager = slidingSyncManager;
        stores._PosthogAnalytics = new MockPosthogAnalytics();
        stores._SpaceStore = new MockSpaceStore();
        roomViewStore = new RoomViewStore(dis, stores);
        stores._RoomViewStore = roomViewStore;
    });

    it("can be used to view a room by ID and join", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        dis.dispatch({ action: Action.JoinRoom });
        await untilDispatch(Action.JoinRoomReady, dis);
        expect(mockClient.joinRoom).toHaveBeenCalledWith(roomId, { viaServers: [] });
        expect(roomViewStore.isJoining()).toBe(true);
    });

    it("can auto-join a room", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId, auto_join: true });
        await untilDispatch(Action.JoinRoomReady, dis);
        expect(mockClient.joinRoom).toHaveBeenCalledWith(roomId, { viaServers: [] });
        expect(roomViewStore.isJoining()).toBe(true);
    });

    it("emits ActiveRoomChanged when the viewed room changes", async () => {
        const roomId2 = "!roomid:2";
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        let payload = (await untilDispatch(Action.ActiveRoomChanged, dis)) as ActiveRoomChangedPayload;
        expect(payload.newRoomId).toEqual(roomId);
        expect(payload.oldRoomId).toEqual(null);

        dis.dispatch({ action: Action.ViewRoom, room_id: roomId2 });
        payload = (await untilDispatch(Action.ActiveRoomChanged, dis)) as ActiveRoomChangedPayload;
        expect(payload.newRoomId).toEqual(roomId2);
        expect(payload.oldRoomId).toEqual(roomId);
    });

    it("invokes room activity listeners when the viewed room changes", async () => {
        const roomId2 = "!roomid:2";
        const callback = jest.fn();
        roomViewStore.addRoomListener(roomId, callback);
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        (await untilDispatch(Action.ActiveRoomChanged, dis)) as ActiveRoomChangedPayload;
        expect(callback).toHaveBeenCalledWith(true);
        expect(callback).not.toHaveBeenCalledWith(false);

        dis.dispatch({ action: Action.ViewRoom, room_id: roomId2 });
        (await untilDispatch(Action.ActiveRoomChanged, dis)) as ActiveRoomChangedPayload;
        expect(callback).toHaveBeenCalledWith(false);
    });

    it("can be used to view a room by alias and join", async () => {
        mockClient.getRoomIdForAlias.mockResolvedValue({ room_id: roomId, servers: [] });
        dis.dispatch({ action: Action.ViewRoom, room_alias: alias });
        await untilDispatch((p) => {
            // wait for the re-dispatch with the room ID
            return p.action === Action.ViewRoom && p.room_id === roomId;
        }, dis);

        // roomId is set to id of the room alias
        expect(roomViewStore.getRoomId()).toBe(roomId);

        // join the room
        dis.dispatch({ action: Action.JoinRoom }, true);

        await untilDispatch(Action.JoinRoomReady, dis);

        expect(roomViewStore.isJoining()).toBeTruthy();
        expect(mockClient.joinRoom).toHaveBeenCalledWith(alias, { viaServers: [] });
    });

    it("emits ViewRoomError if the alias lookup fails", async () => {
        alias = "#something-different:to-ensure-cache-miss";
        mockClient.getRoomIdForAlias.mockRejectedValue(new Error("network error or something"));
        dis.dispatch({ action: Action.ViewRoom, room_alias: alias });
        const payload = await untilDispatch(Action.ViewRoomError, dis);
        expect(payload.room_id).toBeNull();
        expect(payload.room_alias).toEqual(alias);
        expect(roomViewStore.getRoomAlias()).toEqual(alias);
    });

    it("emits JoinRoomError if joining the room fails", async () => {
        const joinErr = new Error("network error or something");
        mockClient.joinRoom.mockRejectedValue(joinErr);
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        dis.dispatch({ action: Action.JoinRoom });
        await untilDispatch(Action.JoinRoomError, dis);
        expect(roomViewStore.isJoining()).toBe(false);
        expect(roomViewStore.getJoinError()).toEqual(joinErr);
    });

    it("remembers the event being replied to when swapping rooms", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        await untilDispatch(Action.ActiveRoomChanged, dis);
        const replyToEvent = {
            getRoomId: () => roomId,
        };
        dis.dispatch({ action: "reply_to_event", event: replyToEvent, context: TimelineRenderingType.Room });
        await untilEmission(roomViewStore, UPDATE_EVENT);
        expect(roomViewStore.getQuotingEvent()).toEqual(replyToEvent);
        // view the same room, should remember the event.
        // set the highlighed flag to make sure there is a state change so we get an update event
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId, highlighted: true });
        await untilEmission(roomViewStore, UPDATE_EVENT);
        expect(roomViewStore.getQuotingEvent()).toEqual(replyToEvent);
    });

    it("swaps to the replied event room if it is not the current room", async () => {
        const roomId2 = "!room2:bar";
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        await untilDispatch(Action.ActiveRoomChanged, dis);
        const replyToEvent = {
            getRoomId: () => roomId2,
        };
        dis.dispatch({ action: "reply_to_event", event: replyToEvent, context: TimelineRenderingType.Room });
        await untilDispatch(Action.ViewRoom, dis);
        expect(roomViewStore.getQuotingEvent()).toEqual(replyToEvent);
        expect(roomViewStore.getRoomId()).toEqual(roomId2);
    });

    it("removes the roomId on ViewHomePage", async () => {
        dis.dispatch({ action: Action.ViewRoom, room_id: roomId });
        await untilDispatch(Action.ActiveRoomChanged, dis);
        expect(roomViewStore.getRoomId()).toEqual(roomId);

        dis.dispatch({ action: Action.ViewHomePage });
        await untilEmission(roomViewStore, UPDATE_EVENT);
        expect(roomViewStore.getRoomId()).toBeNull();
    });

    describe("Sliding Sync", function () {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockImplementation((settingName, roomId, value) => {
                return settingName === "feature_sliding_sync"; // this is enabled, everything else is disabled.
            });
        });

        it("subscribes to the room", async () => {
            const setRoomVisible = jest
                .spyOn(slidingSyncManager, "setRoomVisible")
                .mockReturnValue(Promise.resolve(""));
            const subscribedRoomId = "!sub1:localhost";
            dis.dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId });
            await untilDispatch(Action.ActiveRoomChanged, dis);
            expect(roomViewStore.getRoomId()).toBe(subscribedRoomId);
            expect(setRoomVisible).toHaveBeenCalledWith(subscribedRoomId, true);
        });

        // Regression test for an in-the-wild bug where rooms would rapidly switch forever in sliding sync mode
        it("doesn't get stuck in a loop if you view rooms quickly", async () => {
            const setRoomVisible = jest
                .spyOn(slidingSyncManager, "setRoomVisible")
                .mockReturnValue(Promise.resolve(""));
            const subscribedRoomId = "!sub1:localhost";
            const subscribedRoomId2 = "!sub2:localhost";
            dis.dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId }, true);
            dis.dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId2 }, true);
            await untilDispatch(Action.ActiveRoomChanged, dis);
            // sub(1) then unsub(1) sub(2), unsub(1)
            const wantCalls = [
                [subscribedRoomId, true],
                [subscribedRoomId, false],
                [subscribedRoomId2, true],
                [subscribedRoomId, false],
            ];
            expect(setRoomVisible).toHaveBeenCalledTimes(wantCalls.length);
            wantCalls.forEach((v, i) => {
                try {
                    expect(setRoomVisible.mock.calls[i][0]).toEqual(v[0]);
                    expect(setRoomVisible.mock.calls[i][1]).toEqual(v[1]);
                } catch (err) {
                    throw new Error(`i=${i} got ${setRoomVisible.mock.calls[i]} want ${v}`);
                }
            });
        });
    });
});
