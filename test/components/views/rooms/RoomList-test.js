import React from 'react';
import ReactTestUtils from 'react-dom/test-utils';
import ReactDOM from 'react-dom';

import * as TestUtils from '../../../test-utils';

import {MatrixClientPeg} from '../../../../src/MatrixClientPeg';
import sdk from '../../../skinned-sdk';
import { DragDropContext } from 'react-beautiful-dnd';

import dis from '../../../../src/dispatcher/dispatcher';
import DMRoomMap from '../../../../src/utils/DMRoomMap.js';
import GroupStore from '../../../../src/stores/GroupStore.js';

import { MatrixClient, Room, RoomMember } from 'matrix-js-sdk';
import {DefaultTagID} from "../../../../src/stores/room-list/models";
import RoomListStore, { LISTS_UPDATE_EVENT, RoomListStoreClass } from "../../../../src/stores/room-list/RoomListStore";
import RoomListLayoutStore from "../../../../src/stores/room-list/RoomListLayoutStore";

function generateRoomId() {
    return '!' + Math.random().toString().slice(2, 10) + ':domain';
}

function waitForRoomListStoreUpdate() {
    return new Promise((resolve) => {
        RoomListStore.instance.once(LISTS_UPDATE_EVENT, () => resolve());
    });
}

describe('RoomList', () => {
    function createRoom(opts) {
        const room = new Room(generateRoomId(), null, client.getUserId());
        if (opts) {
            Object.assign(room, opts);
        }
        return room;
    }

    let parentDiv = null;
    let client = null;
    let root = null;
    const myUserId = '@me:domain';

    const movingRoomId = '!someroomid';
    let movingRoom;
    let otherRoom;

    let myMember;
    let myOtherMember;

    beforeEach(async function(done) {
        RoomListStoreClass.TEST_MODE = true;

        TestUtils.stubClient();
        client = MatrixClientPeg.get();
        client.credentials = {userId: myUserId};
        //revert this to prototype method as the test-utils monkey-patches this to return a hardcoded value
        client.getUserId = MatrixClient.prototype.getUserId;

        DMRoomMap.makeShared();

        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);

        const RoomList = sdk.getComponent('views.rooms.RoomList');
        const WrappedRoomList = TestUtils.wrapInMatrixClientContext(RoomList);
        root = ReactDOM.render(
            <DragDropContext>
                <WrappedRoomList searchFilter="" onResize={() => {}} />
            </DragDropContext>
        , parentDiv);
        ReactTestUtils.findRenderedComponentWithType(root, RoomList);

        movingRoom = createRoom({name: 'Moving room'});
        expect(movingRoom.roomId).not.toBe(null);

        // Mock joined member
        myMember = new RoomMember(movingRoomId, myUserId);
        myMember.membership = 'join';
        movingRoom.updateMyMembership('join');
        movingRoom.getMember = (userId) => ({
            [client.credentials.userId]: myMember,
        }[userId]);

        otherRoom = createRoom({name: 'Other room'});
        myOtherMember = new RoomMember(otherRoom.roomId, myUserId);
        myOtherMember.membership = 'join';
        otherRoom.updateMyMembership('join');
        otherRoom.getMember = (userId) => ({
            [client.credentials.userId]: myOtherMember,
        }[userId]);

        // Mock the matrix client
        client.getRooms = () => [
            movingRoom,
            otherRoom,
            createRoom({tags: {'m.favourite': {order: 0.1}}, name: 'Some other room'}),
            createRoom({tags: {'m.favourite': {order: 0.2}}, name: 'Some other room 2'}),
            createRoom({tags: {'m.lowpriority': {}}, name: 'Some unimportant room'}),
            createRoom({tags: {'custom.tag': {}}, name: 'Some room customly tagged'}),
        ];
        client.getVisibleRooms = client.getRooms;

        const roomMap = {};
        client.getRooms().forEach((r) => {
            roomMap[r.roomId] = r;
        });

        client.getRoom = (roomId) => roomMap[roomId];

        // Now that everything has been set up, prepare and update the store
        await RoomListStore.instance.makeReady(client);

        done();
    });

    afterEach(async (done) => {
        if (parentDiv) {
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }

        await RoomListLayoutStore.instance.resetLayouts();
        await RoomListStore.instance.resetStore();

        done();
    });

    function expectRoomInSubList(room, subListTest) {
        const RoomSubList = sdk.getComponent('views.rooms.RoomSublist');
        const RoomTile = sdk.getComponent('views.rooms.RoomTile');

        const subLists = ReactTestUtils.scryRenderedComponentsWithType(root, RoomSubList);
        const containingSubList = subLists.find(subListTest);

        let expectedRoomTile;
        try {
            const roomTiles = ReactTestUtils.scryRenderedComponentsWithType(containingSubList, RoomTile);
            console.info({roomTiles: roomTiles.length});
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
            movingRoom.tags = {[oldTagId]: {}};
        } else if (oldTagId === DefaultTagID.DM) {
            // Mock inverse m.direct
            DMRoomMap.shared().roomToUser = {
                [movingRoom.roomId]: '@someotheruser:domain',
            };
        }

        dis.dispatch({action: 'MatrixActions.sync', prevState: null, state: 'PREPARED', matrixClient: client});

        expectRoomInSubList(movingRoom, srcSubListTest);

        dis.dispatch({action: 'RoomListActions.tagRoom.pending', request: {
            oldTagId, newTagId, room: movingRoom,
        }});

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

    describe('when no tags are selected', () => {
        itDoesCorrectOptimisticUpdatesForDraggedRoomTiles();
    });

    describe('when tags are selected', () => {
        function setupSelectedTag() {
            // Simulate a complete sync BEFORE dispatching anything else
            dis.dispatch({
                action: 'MatrixActions.sync',
                prevState: null,
                state: 'PREPARED',
                matrixClient: client,
            }, true);

            // Simulate joined groups being received
            dis.dispatch({
                action: 'GroupActions.fetchJoinedGroups.success',
                result: {
                    groups: ['+group:domain'],
                },
            }, true);

            // Simulate receiving tag ordering account data
            dis.dispatch({
                action: 'MatrixActions.accountData',
                event_type: 'im.vector.web.tag_ordering',
                event_content: {
                    tags: ['+group:domain'],
                },
            }, true);

            // GroupStore is not flux, mock and notify
            GroupStore.getGroupRooms = (groupId) => {
                return [movingRoom];
            };
            GroupStore._notifyListeners();

            // We also have to mock the client's getGroup function for the room list to filter it.
            // It's not smart enough to tell the difference between a real group and a template though.
            client.getGroup = (groupId) => {
                return {groupId};
            };

            // Select tag
            dis.dispatch({action: 'select_tag', tag: '+group:domain'}, true);
        }

        beforeEach(() => {
            setupSelectedTag();
        });

        it('displays the correct rooms when the groups rooms are changed', async () => {
            GroupStore.getGroupRooms = (groupId) => {
                return [movingRoom, otherRoom];
            };
            GroupStore._notifyListeners();

            await waitForRoomListStoreUpdate();
            expectRoomInSubList(otherRoom, (s) => s.props.tagId === DefaultTagID.Untagged);
        });

        itDoesCorrectOptimisticUpdatesForDraggedRoomTiles();
    });
});


