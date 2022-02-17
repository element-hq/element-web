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

import '../skinned-sdk'; // Must be first for skinning to work
import RoomViewStore from '../../src/stores/RoomViewStore';
import { Action } from '../../src/dispatcher/actions';
import { MatrixClientPeg as peg } from '../../src/MatrixClientPeg';
import * as testUtils from '../test-utils';

const dispatch = testUtils.getDispatchForStore(RoomViewStore);

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
    beforeEach(function() {
        testUtils.stubClient();
        peg.get().credentials = { userId: "@test:example.com" };
        peg.get().on = jest.fn();
        peg.get().off = jest.fn();

        // Reset the state of the store
        RoomViewStore.reset();
    });

    it('can be used to view a room by ID and join', function(done) {
        peg.get().joinRoom = async (roomAddress) => {
            expect(roomAddress).toBe("!randomcharacters:aser.ver");
            done();
        };

        dispatch({ action: Action.ViewRoom, room_id: '!randomcharacters:aser.ver' });
        dispatch({ action: 'join_room' });
        expect(RoomViewStore.isJoining()).toBe(true);
    });

    it('can be used to view a room by alias and join', function(done) {
        const token = RoomViewStore.addListener(() => {
            // Wait until the room alias has resolved and the room ID is
            if (!RoomViewStore.isRoomLoading()) {
                expect(RoomViewStore.getRoomId()).toBe("!randomcharacters:aser.ver");
                dispatch({ action: 'join_room' });
                expect(RoomViewStore.isJoining()).toBe(true);
            }
        });

        peg.get().getRoomIdForAlias.mockResolvedValue({ room_id: "!randomcharacters:aser.ver" });
        peg.get().joinRoom = async (roomAddress) => {
            token.remove(); // stop RVS listener
            expect(roomAddress).toBe("#somealias2:aser.ver");
            done();
        };

        dispatch({ action: Action.ViewRoom, room_alias: '#somealias2:aser.ver' });
    });
});
