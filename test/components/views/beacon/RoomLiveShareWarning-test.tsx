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
// eslint-disable-next-line deprecate/import
import { mount } from 'enzyme';
import { Room, Beacon, BeaconEvent, getBeaconInfoIdentifier } from 'matrix-js-sdk/src/matrix';
import { logger } from 'matrix-js-sdk/src/logger';

import RoomLiveShareWarning from '../../../../src/components/views/beacon/RoomLiveShareWarning';
import { OwnBeaconStore, OwnBeaconStoreEvent } from '../../../../src/stores/OwnBeaconStore';
import {
    advanceDateAndTime,
    findByTestId,
    flushPromisesWithFakeTimers,
    getMockClientWithEventEmitter,
    makeBeaconInfoEvent,
    mockGeolocation,
    resetAsyncStoreWithClient,
    setupAsyncStoreWithClient,
} from '../../../test-utils';
import defaultDispatcher from '../../../../src/dispatcher/dispatcher';
import { Action } from '../../../../src/dispatcher/actions';

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
        sendEvent: jest.fn(),
    });

    // 14.03.2022 16:15
    const now = 1647270879403;
    const MINUTE_MS = 60000;
    const HOUR_MS = 3600000;
    // mock the date so events are stable for snapshots etc
    jest.spyOn(global.Date, 'now').mockReturnValue(now);
    const room1Beacon1 = makeBeaconInfoEvent(aliceId, room1Id, {
        isLive: true,
        timeout: HOUR_MS,
    }, '$0');
    const room2Beacon1 = makeBeaconInfoEvent(aliceId, room2Id, { isLive: true, timeout: HOUR_MS }, '$1');
    const room2Beacon2 = makeBeaconInfoEvent(aliceId, room2Id, { isLive: true, timeout: HOUR_MS * 12 }, '$2');
    const room3Beacon1 = makeBeaconInfoEvent(aliceId, room3Id, { isLive: true, timeout: HOUR_MS }, '$3');

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

    const localStorageSpy = jest.spyOn(localStorage.__proto__, 'getItem').mockReturnValue(undefined);

    beforeEach(() => {
        mockGeolocation();
        jest.spyOn(global.Date, 'now').mockReturnValue(now);
        mockClient.unstable_setLiveBeacon.mockReset().mockResolvedValue({ event_id: '1' });

        // assume all beacons were created on this device
        localStorageSpy.mockReturnValue(JSON.stringify([
            room1Beacon1.getId(),
            room2Beacon1.getId(),
            room2Beacon2.getId(),
            room3Beacon1.getId(),
        ]));
    });

    afterEach(async () => {
        jest.spyOn(OwnBeaconStore.instance, 'beaconHasLocationPublishError').mockRestore();
        await resetAsyncStoreWithClient(OwnBeaconStore.instance);
    });

    afterAll(() => {
        jest.spyOn(global.Date, 'now').mockRestore();
        localStorageSpy.mockRestore();
        jest.spyOn(defaultDispatcher, 'dispatch').mockRestore();
    });

    const getExpiryText = wrapper => findByTestId(wrapper, 'room-live-share-expiry').text();

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

    it('does not render when geolocation is not working', async () => {
        jest.spyOn(logger, 'error').mockImplementation(() => { });
        // @ts-ignore
        navigator.geolocation = undefined;
        await act(async () => {
            await makeRoomsWithStateEvents([room1Beacon1, room2Beacon1, room2Beacon2]);
            await makeOwnBeaconStore();
        });
        const component = getComponent({ roomId: room1Id });

        // beacons have generated ids that break snapshots
        // assert on html
        expect(component.html()).toBeNull();
    });

    describe('when user has live beacons and geolocation is available', () => {
        beforeEach(async () => {
            await act(async () => {
                await makeRoomsWithStateEvents([room1Beacon1, room2Beacon1, room2Beacon2]);
                await makeOwnBeaconStore();
            });
        });

        it('renders correctly with one live beacon in room', () => {
            const component = getComponent({ roomId: room1Id });
            // beacons have generated ids that break snapshots
            // assert on html
            expect(component.html()).toMatchSnapshot();
        });

        it('renders correctly with two live beacons in room', () => {
            const component = getComponent({ roomId: room2Id });
            // beacons have generated ids that break snapshots
            // assert on html
            expect(component.html()).toMatchSnapshot();
            // later expiry displayed
            expect(getExpiryText(component)).toEqual('12h left');
        });

        it('removes itself when user stops having live beacons', async () => {
            const component = getComponent({ roomId: room1Id });
            // started out rendered
            expect(component.html()).toBeTruthy();

            // time travel until room1Beacon1 is expired
            act(() => {
                advanceDateAndTime(HOUR_MS + 1);
            });
            act(() => {
                mockClient.emit(BeaconEvent.LivenessChange, false, new Beacon(room1Beacon1));
                component.setProps({});
            });

            expect(component.html()).toBe(null);
        });

        it('removes itself when user stops monitoring live position', async () => {
            const component = getComponent({ roomId: room1Id });
            // started out rendered
            expect(component.html()).toBeTruthy();

            act(() => {
                // cheat to clear this
                // @ts-ignore
                OwnBeaconStore.instance.clearPositionWatch = undefined;
                OwnBeaconStore.instance.emit(OwnBeaconStoreEvent.MonitoringLivePosition);
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

        it('updates beacon time left periodically', () => {
            const component = getComponent({ roomId: room1Id });
            expect(getExpiryText(component)).toEqual('1h left');

            act(() => {
                advanceDateAndTime(MINUTE_MS * 25);
            });

            expect(getExpiryText(component)).toEqual('35m left');
        });

        it('updates beacon time left when beacon updates', () => {
            const component = getComponent({ roomId: room1Id });
            expect(getExpiryText(component)).toEqual('1h left');

            expect(getExpiryText(component)).toEqual('1h left');

            act(() => {
                const beacon = OwnBeaconStore.instance.getBeaconById(getBeaconInfoIdentifier(room1Beacon1));
                const room1Beacon1Update = makeBeaconInfoEvent(aliceId, room1Id, {
                    isLive: true,
                    timeout: 3 * HOUR_MS,
                }, '$0');
                beacon.update(room1Beacon1Update);
            });

            // update to expiry of new beacon
            expect(getExpiryText(component)).toEqual('3h left');
        });

        it('clears expiry time interval on unmount', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            const component = getComponent({ roomId: room1Id });
            expect(getExpiryText(component)).toEqual('1h left');

            act(() => {
                component.unmount();
            });

            expect(clearIntervalSpy).toHaveBeenCalled();
        });

        it('navigates to beacon tile on click', () => {
            const dispatcherSpy = jest.spyOn(defaultDispatcher, 'dispatch');
            const component = getComponent({ roomId: room1Id });

            act(() => {
                component.simulate('click');
            });

            expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                event_id: room1Beacon1.getId(),
                room_id: room1Id,
                highlighted: true,
                scroll_into_view: true,
                metricsTrigger: undefined,
            });
        });

        describe('stopping beacons', () => {
            it('stops beacon on stop sharing click', () => {
                const component = getComponent({ roomId: room2Id });

                act(() => {
                    findByTestId(component, 'room-live-share-primary-button').at(0).simulate('click');
                    component.setProps({});
                });

                expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalled();
                expect(component.find('Spinner').length).toBeTruthy();
                expect(findByTestId(component, 'room-live-share-primary-button').at(0).props().disabled).toBeTruthy();
            });

            it('displays error when stop sharing fails', async () => {
                const component = getComponent({ roomId: room1Id });

                // fail first time
                mockClient.unstable_setLiveBeacon
                    .mockRejectedValueOnce(new Error('oups'))
                    .mockResolvedValue(({ event_id: '1' }));

                await act(async () => {
                    findByTestId(component, 'room-live-share-primary-button').at(0).simulate('click');
                    await flushPromisesWithFakeTimers();
                });
                component.setProps({});

                expect(component.html()).toMatchSnapshot();

                act(() => {
                    findByTestId(component, 'room-live-share-primary-button').at(0).simulate('click');
                    component.setProps({});
                });

                expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledTimes(2);
            });

            it('displays again with correct state after stopping a beacon', () => {
                // make sure the loading state is reset correctly after removing a beacon
                const component = getComponent({ roomId: room1Id });

                // stop the beacon
                act(() => {
                    findByTestId(component, 'room-live-share-primary-button').at(0).simulate('click');
                });
                // time travel until room1Beacon1 is expired
                act(() => {
                    advanceDateAndTime(HOUR_MS + 1);
                });
                act(() => {
                    mockClient.emit(BeaconEvent.LivenessChange, false, new Beacon(room1Beacon1));
                });

                const newLiveBeacon = makeBeaconInfoEvent(aliceId, room1Id, { isLive: true });
                act(() => {
                    mockClient.emit(BeaconEvent.New, newLiveBeacon, new Beacon(newLiveBeacon));
                });

                // button not disabled and expiry time shown
                expect(findByTestId(component, 'room-live-share-primary-button').at(0).props().disabled).toBeFalsy();
                expect(findByTestId(component, 'room-live-share-expiry').text()).toEqual('1h left');
            });
        });

        describe('with location publish errors', () => {
            it('displays location publish error when mounted with location publish errors', async () => {
                const locationPublishErrorSpy = jest.spyOn(OwnBeaconStore.instance, 'beaconHasLocationPublishError')
                    .mockReturnValue(true);
                const component = getComponent({ roomId: room2Id });

                expect(component).toMatchSnapshot();
                expect(locationPublishErrorSpy).toHaveBeenCalledWith(
                    getBeaconInfoIdentifier(room2Beacon1), 0, [getBeaconInfoIdentifier(room2Beacon1)],
                );
            });

            it(
                'displays location publish error when locationPublishError event is emitted' +
                ' and beacons have errors',
                async () => {
                    const locationPublishErrorSpy = jest.spyOn(OwnBeaconStore.instance, 'beaconHasLocationPublishError')
                        .mockReturnValue(false);
                    const component = getComponent({ roomId: room2Id });

                    // update mock and emit event
                    act(() => {
                        locationPublishErrorSpy.mockReturnValue(true);
                        OwnBeaconStore.instance.emit(
                            OwnBeaconStoreEvent.LocationPublishError, getBeaconInfoIdentifier(room2Beacon1),
                        );
                    });
                    component.setProps({});

                    // renders wire error ui
                    expect(component.find('.mx_RoomLiveShareWarning_label').text()).toEqual(
                        'An error occurred whilst sharing your live location, please try again',
                    );
                    expect(findByTestId(component, 'room-live-share-wire-error-close-button').length).toBeTruthy();
                });

            it('stops displaying wire error when errors are cleared', async () => {
                const locationPublishErrorSpy = jest.spyOn(OwnBeaconStore.instance, 'beaconHasLocationPublishError')
                    .mockReturnValue(true);
                const component = getComponent({ roomId: room2Id });

                // update mock and emit event
                act(() => {
                    locationPublishErrorSpy.mockReturnValue(false);
                    OwnBeaconStore.instance.emit(
                        OwnBeaconStoreEvent.LocationPublishError, getBeaconInfoIdentifier(room2Beacon1),
                    );
                });
                component.setProps({});

                // renders error-free ui
                expect(component.find('.mx_RoomLiveShareWarning_label').text()).toEqual(
                    'You are sharing your live location',
                );
                expect(findByTestId(component, 'room-live-share-wire-error-close-button').length).toBeFalsy();
            });

            it('clicking retry button resets location publish errors', async () => {
                jest.spyOn(OwnBeaconStore.instance, 'beaconHasLocationPublishError').mockReturnValue(true);
                const resetErrorSpy = jest.spyOn(OwnBeaconStore.instance, 'resetLocationPublishError');

                const component = getComponent({ roomId: room2Id });

                act(() => {
                    findByTestId(component, 'room-live-share-primary-button').at(0).simulate('click');
                });

                expect(resetErrorSpy).toHaveBeenCalledWith(getBeaconInfoIdentifier(room2Beacon1));
            });

            it('clicking close button stops beacons', async () => {
                jest.spyOn(OwnBeaconStore.instance, 'beaconHasLocationPublishError').mockReturnValue(true);
                const stopBeaconSpy = jest.spyOn(OwnBeaconStore.instance, 'stopBeacon');

                const component = getComponent({ roomId: room2Id });

                act(() => {
                    findByTestId(component, 'room-live-share-wire-error-close-button').at(0).simulate('click');
                });

                expect(stopBeaconSpy).toHaveBeenCalledWith(getBeaconInfoIdentifier(room2Beacon1));
            });
        });
    });
});
