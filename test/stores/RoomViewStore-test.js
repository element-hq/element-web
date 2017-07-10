import expect from 'expect';

import dis from '../../src/dispatcher';
import RoomViewStore from '../../src/stores/RoomViewStore';


import peg from '../../src/MatrixClientPeg';

import * as testUtils from '../test-utils';
import q from 'q';

const dispatch = testUtils.getDispatchForStore(RoomViewStore);

describe('RoomViewStore', function() {
    let sandbox;

    beforeEach(function() {
        testUtils.beforeEach(this);
        sandbox = testUtils.stubClient();
        peg.get().credentials = { userId: "@test:example.com" };

        // Reset the state of the store
        RoomViewStore.reset();
    });

    afterEach(function() {
        sandbox.restore();
    });

    it('can be used to view a room by ID and join', function(done) {
        peg.get().joinRoom = (roomAddress) => {
            expect(roomAddress).toBe("!randomcharacters:aser.ver");
            done();
        };

        dispatch({ action: 'view_room', room_id: '!randomcharacters:aser.ver' });
        dispatch({ action: 'join_room' });
        expect(RoomViewStore.isJoining()).toBe(true);
    });

    it('can be used to view a room by alias and join', function(done) {
        peg.get().getRoomIdForAlias.returns(q({room_id: "!randomcharacters:aser.ver"}));
        peg.get().joinRoom = (roomAddress) => {
            expect(roomAddress).toBe("#somealias2:aser.ver");
            done();
        };

        RoomViewStore.addListener(() => {
            // Wait until the room alias has resolved and the room ID is
            if (!RoomViewStore.isRoomLoading()) {
                expect(RoomViewStore.getRoomId()).toBe("!randomcharacters:aser.ver");
                dispatch({ action: 'join_room' });
                expect(RoomViewStore.isJoining()).toBe(true);
            }
        });

        dispatch({ action: 'view_room', room_alias: '#somealias2:aser.ver' });
    });
});
