import RoomViewStore from '../../src/stores/RoomViewStore';

import {MatrixClientPeg as peg} from '../../src/MatrixClientPeg';

import * as testUtils from '../test-utils';

const dispatch = testUtils.getDispatchForStore(RoomViewStore);

describe('RoomViewStore', function() {
    beforeEach(function() {
        testUtils.stubClient();
        peg.get().credentials = { userId: "@test:example.com" };

        // Reset the state of the store
        RoomViewStore.reset();
    });

    it('can be used to view a room by ID and join', function(done) {
        peg.get().joinRoom = async (roomAddress) => {
            expect(roomAddress).toBe("!randomcharacters:aser.ver");
            done();
        };

        dispatch({ action: 'view_room', room_id: '!randomcharacters:aser.ver' });
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

        peg.get().getRoomIdForAlias.mockResolvedValue({room_id: "!randomcharacters:aser.ver"});
        peg.get().joinRoom = async (roomAddress) => {
            token.remove(); // stop RVS listener
            expect(roomAddress).toBe("#somealias2:aser.ver");
            done();
        };

        dispatch({ action: 'view_room', room_alias: '#somealias2:aser.ver' });
    });
});
