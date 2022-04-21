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
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import {
    MatrixClient,
    MatrixEvent,
    Room,
    RoomMember,
    getBeaconInfoIdentifier,
} from 'matrix-js-sdk/src/matrix';
import maplibregl from 'maplibre-gl';

import BeaconViewDialog from '../../../../src/components/views/beacon/BeaconViewDialog';
import {
    findByTestId,
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeRoomWithStateEvents,
} from '../../../test-utils';
import { TILE_SERVER_WK_KEY } from '../../../../src/utils/WellKnownUtils';
import { OwnBeaconStore } from '../../../../src/stores/OwnBeaconStore';
import { BeaconDisplayStatus } from '../../../../src/components/views/beacon/displayStatus';

describe('<BeaconViewDialog />', () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    // stable date for snapshots
    jest.spyOn(global.Date, 'now').mockReturnValue(now);
    const roomId = '!room:server';
    const aliceId = '@alice:server';
    const bobId = '@bob:server';

    const aliceMember = new RoomMember(roomId, aliceId);

    const mockClient = getMockClientWithEventEmitter({
        getClientWellKnown: jest.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: 'maps.com' },
        }),
        getUserId: jest.fn().mockReturnValue(bobId),
        getRoom: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
        getVisibleRooms: jest.fn().mockReturnValue([]),
    });

    const mockMap = new maplibregl.Map();

    // make fresh rooms every time
    // as we update room state
    const setupRoom = (stateEvents: MatrixEvent[] = []): Room => {
        const room1 = makeRoomWithStateEvents(stateEvents, { roomId, mockClient });
        jest.spyOn(room1, 'getMember').mockReturnValue(aliceMember);

        return room1;
    };

    const defaultEvent = makeBeaconInfoEvent(aliceId,
        roomId,
        { isLive: true },
        '$alice-room1-1',
    );

    const location1 = makeBeaconEvent(
        aliceId, { beaconInfoId: defaultEvent.getId(), geoUri: 'geo:51,41', timestamp: now + 1 },
    );

    const defaultProps = {
        onFinished: jest.fn(),
        roomId,
        matrixClient: mockClient as MatrixClient,
    };

    const getComponent = (props = {}) =>
        mount(<BeaconViewDialog {...defaultProps} {...props} />);

    beforeEach(() => {
        jest.spyOn(OwnBeaconStore.instance, 'getLiveBeaconIds').mockRestore();

        jest.clearAllMocks();
    });

    it('renders a map with markers', () => {
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        const component = getComponent();
        expect(component.find('Map').props()).toEqual(expect.objectContaining({
            centerGeoUri: 'geo:51,41',
            interactive: true,
        }));
        expect(component.find('SmartMarker').length).toEqual(1);
    });

    it('does not render any own beacon status when user is not live sharing', () => {
        // default event belongs to alice, we are bob
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        const component = getComponent();
        expect(component.find('DialogOwnBeaconStatus').html()).toBeNull();
    });

    it('renders own beacon status when user is live sharing', () => {
        // default event belongs to alice
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        // mock own beacon store to show default event as alice's live beacon
        jest.spyOn(OwnBeaconStore.instance, 'getLiveBeaconIds').mockReturnValue([beacon.identifier]);
        jest.spyOn(OwnBeaconStore.instance, 'getBeaconById').mockReturnValue(beacon);
        const component = getComponent();
        expect(component.find('MemberAvatar').length).toBeTruthy();
        expect(component.find('OwnBeaconStatus').props()).toEqual({
            beacon, displayStatus: BeaconDisplayStatus.Active,
            className: 'mx_DialogOwnBeaconStatus_status',
        });
    });

    it('updates markers on changes to beacons', () => {
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        const component = getComponent();
        expect(component.find('BeaconMarker').length).toEqual(1);

        const anotherBeaconEvent = makeBeaconInfoEvent(bobId,
            roomId,
            { isLive: true },
            '$bob-room1-1',
        );

        act(() => {
            // emits RoomStateEvent.BeaconLiveness
            room.currentState.setStateEvents([anotherBeaconEvent]);
        });

        component.setProps({});

        // two markers now!
        expect(component.find('BeaconMarker').length).toEqual(2);
    });

    it('does not update bounds or center on changing beacons', () => {
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        const component = getComponent();
        expect(component.find('BeaconMarker').length).toEqual(1);

        const anotherBeaconEvent = makeBeaconInfoEvent(bobId,
            roomId,
            { isLive: true },
            '$bob-room1-1',
        );

        act(() => {
            // emits RoomStateEvent.BeaconLiveness
            room.currentState.setStateEvents([anotherBeaconEvent]);
        });

        component.setProps({});

        // two markers now!
        expect(mockMap.setCenter).toHaveBeenCalledTimes(1);
        expect(mockMap.fitBounds).toHaveBeenCalledTimes(1);
    });

    it('renders a fallback when no live beacons remain', () => {
        const onFinished = jest.fn();
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        const component = getComponent({ onFinished });
        expect(component.find('BeaconMarker').length).toEqual(1);

        // this will replace the defaultEvent
        // leading to no more live beacons
        const anotherBeaconEvent = makeBeaconInfoEvent(aliceId,
            roomId,
            { isLive: false },
            '$bob-room1-1',
        );

        act(() => {
            // emits RoomStateEvent.BeaconLiveness
            room.currentState.setStateEvents([anotherBeaconEvent]);
        });

        component.setProps({});

        // map placeholder
        expect(findByTestId(component, 'beacon-view-dialog-map-fallback')).toMatchSnapshot();

        act(() => {
            findByTestId(component, 'beacon-view-dialog-fallback-close').at(0).simulate('click');
        });

        expect(onFinished).toHaveBeenCalled();
    });

    describe('sidebar', () => {
        it('opens sidebar on view list button click', () => {
            const room = setupRoom([defaultEvent]);
            const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
            beacon.addLocations([location1]);
            const component = getComponent();

            act(() => {
                findByTestId(component, 'beacon-view-dialog-open-sidebar').at(0).simulate('click');
                component.setProps({});
            });

            expect(component.find('DialogSidebar').length).toBeTruthy();
        });

        it('closes sidebar on close button click', () => {
            const room = setupRoom([defaultEvent]);
            const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
            beacon.addLocations([location1]);
            const component = getComponent();

            // open the sidebar
            act(() => {
                findByTestId(component, 'beacon-view-dialog-open-sidebar').at(0).simulate('click');
                component.setProps({});
            });

            expect(component.find('DialogSidebar').length).toBeTruthy();

            // now close it
            act(() => {
                findByTestId(component, 'dialog-sidebar-close').at(0).simulate('click');
                component.setProps({});
            });

            expect(component.find('DialogSidebar').length).toBeFalsy();
        });
    });
});
