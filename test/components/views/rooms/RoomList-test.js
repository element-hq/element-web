import React from 'react';
import ReactTestUtils from 'react-addons-test-utils';
import ReactDOM from 'react-dom';
import expect from 'expect';
import lolex from 'lolex';

import * as TestUtils from 'test-utils';

import sdk from '../../../../src/index';
import MatrixClientPeg from '../../../../src/MatrixClientPeg';
import { DragDropContext } from 'react-beautiful-dnd';

import dis from '../../../../src/dispatcher';
import DMRoomMap from '../../../../src/utils/DMRoomMap.js';

import { Room, RoomMember } from 'matrix-js-sdk';

describe('RoomList', () => {
    let parentDiv = null;
    let sandbox = null;
    let client = null;
    let root = null;
    const myUserId = '@me:domain';
    let clock = null;

    beforeEach(function() {
        TestUtils.beforeEach(this);
        sandbox = TestUtils.stubClient(sandbox);
        client = MatrixClientPeg.get();
        client.credentials = {userId: myUserId};

        clock = lolex.install();

        DMRoomMap.makeShared();

        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);

        const RoomList = sdk.getComponent('views.rooms.RoomList');
        const WrappedRoomList = TestUtils.wrapInMatrixClientContext(RoomList);
        root = ReactDOM.render(
            <DragDropContext>
                <WrappedRoomList searchFilter="" />
            </DragDropContext>
        , parentDiv);
        ReactTestUtils.findRenderedComponentWithType(root, RoomList);
    });

    afterEach((done) => {
        if (parentDiv) {
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }
        sandbox.restore();

        clock.uninstall();

        done();
    });

    describe('when no tags are selected', () => {
        describe('does correct optimistic update when dragging from', () => {
            const movingRoomId = '!someroomid';
            const movingRoom = new Room(movingRoomId);

            // Mock joined member
            const myMember = new RoomMember(movingRoomId, myUserId);
            myMember.membership = 'join';
            movingRoom.getMember = (userId) => ({
                [client.credentials.userId]: myMember,
            }[userId]);

            function expectRoomInSubList(room, subListTest) {
                const RoomSubList = sdk.getComponent('structures.RoomSubList');
                const RoomTile = sdk.getComponent('views.rooms.RoomTile');

                const subLists = ReactTestUtils.scryRenderedComponentsWithType(root, RoomSubList);
                const containingSubList = subLists.find(subListTest);

                let expectedRoomTile;
                try {
                    expectedRoomTile = ReactTestUtils.findRenderedComponentWithType(containingSubList, RoomTile);
                } catch (err) {
                    // truncate the error message because it's spammy
                    err.message = 'Error finding RoomTile: ' + err.message.split('componentType')[0] + '...';
                    throw err;
                }

                expect(expectedRoomTile).toExist();
                expect(expectedRoomTile.props.room).toBe(room);
            }

            function expectCorrectMove(oldTag, newTag) {
                const getTagSubListTest = (tag) => {
                    if (tag === undefined) return (s) => s.props.label.endsWith('Rooms');
                    return (s) => s.props.tagName === tag;
                };

                // Default to finding the destination sublist with newTag
                const destSubListTest = getTagSubListTest(newTag);
                const srcSubListTest = getTagSubListTest(oldTag);

                // Mock the matrix client
                client.getRooms = () => [movingRoom];

                if (['m.favourite', 'm.lowpriority'].includes(oldTag)) movingRoom.tags = {[oldTag]: {}};
                if (oldTag === 'im.vector.fake.direct') {
                    // Mock inverse m.direct
                    DMRoomMap.shared().roomToUser = {
                        [movingRoom.roomId]: '@someotheruser:domain',
                    };
                }

                dis.dispatch({action: 'MatrixActions.sync', prevState: null, state: 'PREPARED', matrixClient: client});

                clock.runAll();

                expectRoomInSubList(movingRoom, srcSubListTest);

                dis.dispatch({action: 'RoomListActions.tagRoom.pending', request: {
                    oldTag, newTag, room: movingRoom,
                }});

                // Run all setTimeouts for dispatches and room list rate limiting
                clock.runAll();

                expectRoomInSubList(movingRoom, destSubListTest);
            }

            it('rooms to people', () => {
                expectCorrectMove(undefined, 'im.vector.fake.direct');
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
                expectCorrectMove('im.vector.fake.direct', undefined);
            });

            it('people to favourites', () => {
                expectCorrectMove('im.vector.fake.direct', 'm.favourite');
            });

            it('people to lowpriority', () => {
                expectCorrectMove('im.vector.fake.direct', 'm.lowpriority');
            });

            it('low priority to rooms', () => {
                expectCorrectMove('m.lowpriority', undefined);
            });

            it('low priority to people', () => {
                expectCorrectMove('m.lowpriority', 'im.vector.fake.direct');
            });

            it('low priority to low priority', () => {
                expectCorrectMove('m.lowpriority', 'm.lowpriority');
            });

            it('favourites to rooms', () => {
                expectCorrectMove('m.favourite', undefined);
            });

            it('favourites to people', () => {
                expectCorrectMove('m.favourite', 'im.vector.fake.direct');
            });

            it('favourites to low priority', () => {
                expectCorrectMove('m.favourite', 'm.lowpriority');
            });
        });
    });
});


