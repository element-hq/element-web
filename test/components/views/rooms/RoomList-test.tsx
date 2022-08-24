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

import React from 'react';
import ReactTestUtils from 'react-dom/test-utils';
import ReactDOM from 'react-dom';
import {
    PendingEventOrdering,
    Room,
    RoomMember,
} from 'matrix-js-sdk/src/matrix';

import * as TestUtils from '../../../test-utils';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import dis from '../../../../src/dispatcher/dispatcher';
import DMRoomMap from '../../../../src/utils/DMRoomMap';
import { DefaultTagID } from "../../../../src/stores/room-list/models";
import RoomListStore, { RoomListStoreClass } from "../../../../src/stores/room-list/RoomListStore";
import RoomListLayoutStore from "../../../../src/stores/room-list/RoomListLayoutStore";
import RoomList from "../../../../src/components/views/rooms/RoomList";
import RoomSublist from "../../../../src/components/views/rooms/RoomSublist";
import RoomTile from "../../../../src/components/views/rooms/RoomTile";
import { getMockClientWithEventEmitter, mockClientMethodsUser } from '../../../test-utils';
import ResizeNotifier from '../../../../src/utils/ResizeNotifier';

function generateRoomId() {
    return '!' + Math.random().toString().slice(2, 10) + ':domain';
}

describe('RoomList', () => {
    function createRoom(opts) {
        const room = new Room(generateRoomId(), MatrixClientPeg.get(), client.getUserId(), {
            // The room list now uses getPendingEvents(), so we need a detached ordering.
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        if (opts) {
            Object.assign(room, opts);
        }
        return room;
    }

    let parentDiv = null;
    let root = null;
    const myUserId = '@me:domain';

    const movingRoomId = '!someroomid';
    let movingRoom: Room | undefined;
    let otherRoom: Room | undefined;

    let myMember: RoomMember | undefined;
    let myOtherMember: RoomMember | undefined;

    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(myUserId),
        getRooms: jest.fn(),
        getVisibleRooms: jest.fn(),
        getRoom: jest.fn(),
    });

    const defaultProps = {
        onKeyDown: jest.fn(),
        onFocus: jest.fn(),
        onBlur: jest.fn(),
        onResize: jest.fn(),
        resizeNotifier: {} as unknown as ResizeNotifier,
        isMinimized: false,
        activeSpace: '',
    };

    beforeEach(async function(done) {
        RoomListStoreClass.TEST_MODE = true;
        jest.clearAllMocks();

        client.credentials = { userId: myUserId };

        DMRoomMap.makeShared();

        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);

        const WrappedRoomList = TestUtils.wrapInMatrixClientContext(RoomList);
        root = ReactDOM.render(
            <WrappedRoomList {...defaultProps} />,
            parentDiv,
        );
        ReactTestUtils.findRenderedComponentWithType(root, RoomList);

        movingRoom = createRoom({ name: 'Moving room' });
        expect(movingRoom.roomId).not.toBe(null);

        // Mock joined member
        myMember = new RoomMember(movingRoomId, myUserId);
        myMember.membership = 'join';
        movingRoom.updateMyMembership('join');
        movingRoom.getMember = (userId) => ({
            [client.credentials.userId]: myMember,
        }[userId]);

        otherRoom = createRoom({ name: 'Other room' });
        myOtherMember = new RoomMember(otherRoom.roomId, myUserId);
        myOtherMember.membership = 'join';
        otherRoom.updateMyMembership('join');
        otherRoom.getMember = (userId) => ({
            [client.credentials.userId]: myOtherMember,
        }[userId]);

        // Mock the matrix client
        const mockRooms = [
            movingRoom,
            otherRoom,
            createRoom({ tags: { 'm.favourite': { order: 0.1 } }, name: 'Some other room' }),
            createRoom({ tags: { 'm.favourite': { order: 0.2 } }, name: 'Some other room 2' }),
            createRoom({ tags: { 'm.lowpriority': {} }, name: 'Some unimportant room' }),
            createRoom({ tags: { 'custom.tag': {} }, name: 'Some room customly tagged' }),
        ];
        client.getRooms.mockReturnValue(mockRooms);
        client.getVisibleRooms.mockReturnValue(mockRooms);

        const roomMap = {};
        client.getRooms().forEach((r) => {
            roomMap[r.roomId] = r;
        });

        client.getRoom.mockImplementation((roomId) => roomMap[roomId]);

        // Now that everything has been set up, prepare and update the store
        await (RoomListStore.instance as RoomListStoreClass).makeReady(client);

        done();
    });

    afterEach(async (done) => {
        if (parentDiv) {
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }

        await RoomListLayoutStore.instance.resetLayouts();
        await (RoomListStore.instance as RoomListStoreClass).resetStore();

        done();
    });

    function expectRoomInSubList(room, subListTest) {
        const subLists = ReactTestUtils.scryRenderedComponentsWithType(root, RoomSublist);
        const containingSubList = subLists.find(subListTest);

        let expectedRoomTile;
        try {
            const roomTiles = ReactTestUtils.scryRenderedComponentsWithType(containingSubList, RoomTile);
            console.info({ roomTiles: roomTiles.length });
            expectedRoomTile = roomTiles.find((tile) => tile.props.room === room);
        } catch (err) {
            // truncate the error message because it's spammy
            err.message = 'Error finding RoomTile for ' + room.roomId + ' in ' +
                subListTest + ': ' +
                err.message.split('componentType')[0] + '...';
            throw err;
        }

        expect(expectedRoomTile).toBeTruthy();
        expect(expectedRoomTile.props.room).toBe(room);
    }

    function expectCorrectMove(oldTagId, newTagId) {
        const getTagSubListTest = (tagId) => {
            return (s) => s.props.tagId === tagId;
        };

        // Default to finding the destination sublist with newTag
        const destSubListTest = getTagSubListTest(newTagId);
        const srcSubListTest = getTagSubListTest(oldTagId);

        // Set up the room that will be moved such that it has the correct state for a room in
        // the section for oldTagId
        if (oldTagId === DefaultTagID.Favourite || oldTagId === DefaultTagID.LowPriority) {
            movingRoom.tags = { [oldTagId]: {} };
        } else if (oldTagId === DefaultTagID.DM) {
            // Mock inverse m.direct
            // @ts-ignore forcing private property
            DMRoomMap.shared().roomToUser = {
                [movingRoom.roomId]: '@someotheruser:domain',
            };
        }

        dis.dispatch({ action: 'MatrixActions.sync', prevState: null, state: 'PREPARED', matrixClient: client });

        expectRoomInSubList(movingRoom, srcSubListTest);

        dis.dispatch({ action: 'RoomListActions.tagRoom.pending', request: {
            oldTagId, newTagId, room: movingRoom,
        } });

        expectRoomInSubList(movingRoom, destSubListTest);
    }

    function itDoesCorrectOptimisticUpdatesForDraggedRoomTiles() {
        // TODO: Re-enable dragging tests when we support dragging again.
        describe.skip('does correct optimistic update when dragging from', () => {
            it('rooms to people', () => {
                expectCorrectMove(undefined, DefaultTagID.DM);
            });

            it('rooms to favourites', () => {
                expectCorrectMove(undefined, 'm.favourite');
            });

            it('rooms to low priority', () => {
                expectCorrectMove(undefined, 'm.lowpriority');
            });

            // XXX: Known to fail - the view does not update immediately to reflect the change.
            // Whe running the app live, it updates when some other event occurs (likely the
            // m.direct arriving) that these tests do not fire.
            xit('people to rooms', () => {
                expectCorrectMove(DefaultTagID.DM, undefined);
            });

            it('people to favourites', () => {
                expectCorrectMove(DefaultTagID.DM, 'm.favourite');
            });

            it('people to lowpriority', () => {
                expectCorrectMove(DefaultTagID.DM, 'm.lowpriority');
            });

            it('low priority to rooms', () => {
                expectCorrectMove('m.lowpriority', undefined);
            });

            it('low priority to people', () => {
                expectCorrectMove('m.lowpriority', DefaultTagID.DM);
            });

            it('low priority to low priority', () => {
                expectCorrectMove('m.lowpriority', 'm.lowpriority');
            });

            it('favourites to rooms', () => {
                expectCorrectMove('m.favourite', undefined);
            });

            it('favourites to people', () => {
                expectCorrectMove('m.favourite', DefaultTagID.DM);
            });

            it('favourites to low priority', () => {
                expectCorrectMove('m.favourite', 'm.lowpriority');
            });
        });
    }

    itDoesCorrectOptimisticUpdatesForDraggedRoomTiles();
});

