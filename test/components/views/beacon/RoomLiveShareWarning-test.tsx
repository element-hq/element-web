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
import { act } from 'react-dom/test-utils';
import { mount } from 'enzyme';
import { Room, Beacon, BeaconEvent } from 'matrix-js-sdk/src/matrix';

import '../../../skinned-sdk';
import RoomLiveShareWarning from '../../../../src/components/views/beacon/RoomLiveShareWarning';
import { OwnBeaconStore } from '../../../../src/stores/OwnBeaconStore';
import {
    findByTestId,
    getMockClientWithEventEmitter,
    makeBeaconInfoEvent,
    resetAsyncStoreWithClient,
    setupAsyncStoreWithClient,
} from '../../../test-utils';

jest.useFakeTimers();
describe('<RoomLiveShareWarning />', () => {
    const aliceId = '@alice:server.org';
    const room1Id = '$room1:server.org';
    const room2Id = '$room2:server.org';
    const room3Id = '$room3:server.org';
    const mockClient = getMockClientWithEventEmitter({
        getVisibleRooms: jest.fn().mockReturnValue([]),
        getUserId: jest.fn().mockReturnValue(aliceId),
        unstable_setLiveBeacon: jest.fn().mockResolvedValue({ event_id: '1' }),
    });

    // 14.03.2022 16:15
    const now = 1647270879403;
    const HOUR_MS = 3600000;
    // mock the date so events are stable for snapshots etc
    jest.spyOn(global.Date, 'now').mockReturnValue(now);
    const room1Beacon1 = makeBeaconInfoEvent(aliceId, room1Id, { isLive: true, timeout: HOUR_MS });
    const room2Beacon1 = makeBeaconInfoEvent(aliceId, room2Id, { isLive: true, timeout: HOUR_MS });
    const room2Beacon2 = makeBeaconInfoEvent(aliceId, room2Id, { isLive: true, timeout: HOUR_MS * 12 });
    const room3Beacon1 = makeBeaconInfoEvent(aliceId, room3Id, { isLive: true, timeout: HOUR_MS });

    // make fresh rooms every time
    // as we update room state
    const makeRoomsWithStateEvents = (stateEvents = []): [Room, Room] => {
        const room1 = new Room(room1Id, mockClient, aliceId);
        const room2 = new Room(room2Id, mockClient, aliceId);

        room1.currentState.setStateEvents(stateEvents);
        room2.currentState.setStateEvents(stateEvents);
        mockClient.getVisibleRooms.mockReturnValue([room1, room2]);

        return [room1, room2];
    };

    const advanceDateAndTime = (ms: number) => {
        // bc liveness check uses Date.now we have to advance this mock
        jest.spyOn(global.Date, 'now').mockReturnValue(now + ms);
        // then advance time for the interval by the same amount
        jest.advanceTimersByTime(ms);
    };

    const makeOwnBeaconStore = async () => {
        const store = OwnBeaconStore.instance;

        await setupAsyncStoreWithClient(store, mockClient);
        return store;
    };

    const defaultProps = {
        roomId: room1Id,
    };
    const getComponent = (props = {}) => {
        let component;
        // component updates on render
        // wrap in act
        act(() => {
            component = mount(<RoomLiveShareWarning {...defaultProps} {...props} />);
        });
        return component;
    };

    beforeEach(() => {
        jest.spyOn(global.Date, 'now').mockReturnValue(now);
        mockClient.unstable_setLiveBeacon.mockClear();
    });

    afterEach(async () => {
        await resetAsyncStoreWithClient(OwnBeaconStore.instance);
    });

    afterAll(() => {
        jest.spyOn(global.Date, 'now').mockRestore();
    });

    it('renders nothing when user has no live beacons at all', async () => {
        await makeOwnBeaconStore();
        const component = getComponent();
        expect(component.html()).toBe(null);
    });

    it('renders nothing when user has no live beacons in room', async () => {
        await act(async () => {
            await makeRoomsWithStateEvents([room2Beacon1]);
            await makeOwnBeaconStore();
        });
        const component = getComponent({ roomId: room1Id });
        expect(component.html()).toBe(null);
    });

    describe('when user has live beacons', () => {
        beforeEach(async () => {
            await act(async () => {
                await makeRoomsWithStateEvents([room1Beacon1, room2Beacon1, room2Beacon2]);
                await makeOwnBeaconStore();
            });
        });

        it('renders correctly with one live beacon in room', () => {
            const component = getComponent({ roomId: room1Id });
            expect(component).toMatchSnapshot();
        });

        it('renders correctly with two live beacons in room', () => {
            const component = getComponent({ roomId: room2Id });
            expect(component).toMatchSnapshot();
            // later expiry displayed
            expect(findByTestId(component, 'room-live-share-expiry').text()).toEqual('12h left');
        });

        it('removes itself when user stops having live beacons', async () => {
            const component = getComponent({ roomId: room1Id });
            // started out rendered
            expect(component.html()).toBeTruthy();

            // time travel until room1Beacon1 is expired
            advanceDateAndTime(HOUR_MS + 1);
            act(() => {
                mockClient.emit(BeaconEvent.LivenessChange, false, new Beacon(room1Beacon1));
                component.setProps({});
            });

            expect(component.html()).toBe(null);
        });

        it('renders when user adds a live beacon', async () => {
            const component = getComponent({ roomId: room3Id });
            // started out not rendered
            expect(component.html()).toBeFalsy();

            act(() => {
                mockClient.emit(BeaconEvent.New, room3Beacon1, new Beacon(room3Beacon1));
                component.setProps({});
            });

            expect(component.html()).toBeTruthy();
        });

        describe('stopping beacons', () => {
            it('stops beacon on stop sharing click', () => {
                const component = getComponent({ roomId: room2Id });

                act(() => {
                    findByTestId(component, 'room-live-share-stop-sharing').at(0).simulate('click');
                    component.setProps({});
                });

                expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledTimes(2);
                expect(component.find('Spinner').length).toBeTruthy();
                expect(findByTestId(component, 'room-live-share-stop-sharing').at(0).props().disabled).toBeTruthy();
            });

            it('displays again with correct state after stopping a beacon', () => {
                // make sure the loading state is reset correctly after removing a beacon
                const component = getComponent({ roomId: room2Id });

                act(() => {
                    findByTestId(component, 'room-live-share-stop-sharing').at(0).simulate('click');
                });
                // time travel until room1Beacon1 is expired
                advanceDateAndTime(HOUR_MS + 1);
                act(() => {
                    mockClient.emit(BeaconEvent.LivenessChange, false, new Beacon(room1Beacon1));
                });

                const newLiveBeacon = makeBeaconInfoEvent(aliceId, room2Id, { isLive: true });
                act(() => {
                    mockClient.emit(BeaconEvent.New, newLiveBeacon, new Beacon(newLiveBeacon));
                });

                // button not disabled and expiry time shown
                expect(findByTestId(component, 'room-live-share-stop-sharing').at(0).props().disabled).toBeFalsy();
                expect(findByTestId(component, 'room-live-share-expiry').text()).toEqual('11h left');
            });
        });
    });
});
