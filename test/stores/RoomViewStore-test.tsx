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
    });
    const room = new Room('!room:server', mockClient, userId);

    beforeEach(function() {
        jest.clearAllMocks();
        mockClient.credentials = { userId: "@test:example.com" };
        mockClient.joinRoom.mockResolvedValue(room);
        mockClient.getRoom.mockReturnValue(room);

        // Reset the state of the store
        RoomViewStore.instance.reset();
    });

    it('can be used to view a room by ID and join', async () => {
        dispatch({ action: Action.ViewRoom, room_id: '!randomcharacters:aser.ver' });
        dispatch({ action: 'join_room' });
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
        dispatch({ action: 'join_room' });

        expect(RoomViewStore.instance.isJoining()).toBeTruthy();
        await flushPromises();

        expect(mockClient.joinRoom).toHaveBeenCalledWith(alias, { viaServers: [] });
    });
});
