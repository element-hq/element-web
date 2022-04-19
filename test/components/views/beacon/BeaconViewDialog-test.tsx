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
    Room,
    RoomMember,
    getBeaconInfoIdentifier,
} from 'matrix-js-sdk/src/matrix';

import BeaconViewDialog from '../../../../src/components/views/beacon/BeaconViewDialog';
import {
    findByTestId,
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
} from '../../../test-utils';
import { TILE_SERVER_WK_KEY } from '../../../../src/utils/WellKnownUtils';

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
        getUserId: jest.fn().mockReturnValue(aliceId),
        getRoom: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
    });

    // make fresh rooms every time
    // as we update room state
    const makeRoomWithStateEvents = (stateEvents = []): Room => {
        const room1 = new Room(roomId, mockClient, aliceId);

        room1.currentState.setStateEvents(stateEvents);
        jest.spyOn(room1, 'getMember').mockReturnValue(aliceMember);
        mockClient.getRoom.mockReturnValue(room1);

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

    it('renders a map with markers', () => {
        const room = makeRoomWithStateEvents([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        const component = getComponent();
        expect(component.find('Map').props()).toEqual(expect.objectContaining({
            centerGeoUri: 'geo:51,41',
            interactive: true,
        }));
        expect(component.find('SmartMarker').length).toEqual(1);
    });

    it('updates markers on changes to beacons', () => {
        const room = makeRoomWithStateEvents([defaultEvent]);
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

    it('renders a fallback when no live beacons remain', () => {
        const onFinished = jest.fn();
        const room = makeRoomWithStateEvents([defaultEvent]);
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
});
