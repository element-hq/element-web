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

import { Room } from 'matrix-js-sdk/src/matrix';

import { RoomViewStore } from '../../src/stores/RoomViewStore';
import { Action } from '../../src/dispatcher/actions';
import * as testUtils from '../test-utils';
import { flushPromises, getMockClientWithEventEmitter } from '../test-utils';
import SettingsStore from '../../src/settings/SettingsStore';
import { SlidingSyncManager } from '../../src/SlidingSyncManager';
import { TimelineRenderingType } from '../../src/contexts/RoomContext';

const dispatch = testUtils.getDispatchForStore(RoomViewStore.instance);

jest.mock('../../src/utils/DMRoomMap', () => {
    const mock = {
        getUserIdForRoomId: jest.fn(),
        getDMRoomsForUserId: jest.fn(),
    };

    return {
        shared: jest.fn().mockReturnValue(mock),
        sharedInstance: mock,
    };
});

describe('RoomViewStore', function() {
    const userId = '@alice:server';
    const mockClient = getMockClientWithEventEmitter({
        joinRoom: jest.fn(),
        getRoom: jest.fn(),
        getRoomIdForAlias: jest.fn(),
        isGuest: jest.fn(),
    });
    const room = new Room('!room:server', mockClient, userId);

    beforeEach(function() {
        jest.clearAllMocks();
        mockClient.credentials = { userId: userId };
        mockClient.joinRoom.mockResolvedValue(room);
        mockClient.getRoom.mockReturnValue(room);
        mockClient.isGuest.mockReturnValue(false);

        // Reset the state of the store
        RoomViewStore.instance.reset();
    });

    it('can be used to view a room by ID and join', async () => {
        dispatch({ action: Action.ViewRoom, room_id: '!randomcharacters:aser.ver' });
        dispatch({ action: Action.JoinRoom });
        await flushPromises();
        expect(mockClient.joinRoom).toHaveBeenCalledWith('!randomcharacters:aser.ver', { viaServers: [] });
        expect(RoomViewStore.instance.isJoining()).toBe(true);
    });

    it('can be used to view a room by alias and join', async () => {
        const roomId = "!randomcharacters:aser.ver";
        const alias = "#somealias2:aser.ver";

        mockClient.getRoomIdForAlias.mockResolvedValue({ room_id: roomId, servers: [] });

        dispatch({ action: Action.ViewRoom, room_alias: alias });
        await flushPromises();
        await flushPromises();

        // roomId is set to id of the room alias
        expect(RoomViewStore.instance.getRoomId()).toBe(roomId);

        // join the room
        dispatch({ action: Action.JoinRoom });

        expect(RoomViewStore.instance.isJoining()).toBeTruthy();
        await flushPromises();

        expect(mockClient.joinRoom).toHaveBeenCalledWith(alias, { viaServers: [] });
    });

    it('remembers the event being replied to when swapping rooms', async () => {
        dispatch({ action: Action.ViewRoom, room_id: '!randomcharacters:aser.ver' });
        await flushPromises();
        const replyToEvent = {
            getRoomId: () => '!randomcharacters:aser.ver',
        };
        dispatch({ action: 'reply_to_event', event: replyToEvent, context: TimelineRenderingType.Room });
        await flushPromises();
        expect(RoomViewStore.instance.getQuotingEvent()).toEqual(replyToEvent);
        // view the same room, should remember the event.
        dispatch({ action: Action.ViewRoom, room_id: '!randomcharacters:aser.ver' });
        await flushPromises();
        expect(RoomViewStore.instance.getQuotingEvent()).toEqual(replyToEvent);
    });

    describe('Sliding Sync', function() {
        beforeEach(() => {
            jest.spyOn(SettingsStore, 'getValue').mockImplementation((settingName, roomId, value) => {
                return settingName === "feature_sliding_sync"; // this is enabled, everything else is disabled.
            });
            RoomViewStore.instance.reset();
        });

        it("subscribes to the room", async () => {
            const setRoomVisible = jest.spyOn(SlidingSyncManager.instance, "setRoomVisible").mockReturnValue(
                Promise.resolve(""),
            );
            const subscribedRoomId = "!sub1:localhost";
            dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId });
            await flushPromises();
            await flushPromises();
            expect(RoomViewStore.instance.getRoomId()).toBe(subscribedRoomId);
            expect(setRoomVisible).toHaveBeenCalledWith(subscribedRoomId, true);
        });

        // Regression test for an in-the-wild bug where rooms would rapidly switch forever in sliding sync mode
        it("doesn't get stuck in a loop if you view rooms quickly", async () => {
            const setRoomVisible = jest.spyOn(SlidingSyncManager.instance, "setRoomVisible").mockReturnValue(
                Promise.resolve(""),
            );
            const subscribedRoomId = "!sub2:localhost";
            const subscribedRoomId2 = "!sub3:localhost";
            dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId });
            dispatch({ action: Action.ViewRoom, room_id: subscribedRoomId2 });
            // sub(1) then unsub(1) sub(2)
            expect(setRoomVisible).toHaveBeenCalledTimes(3);
            await flushPromises();
            await flushPromises();
            // this should not churn, extra call to allow unsub(1)
            expect(setRoomVisible).toHaveBeenCalledTimes(4);
            // flush a bit more to ensure this doesn't change
            await flushPromises();
            await flushPromises();
            expect(setRoomVisible).toHaveBeenCalledTimes(4);
        });
    });
});
