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
// eslint-disable-next-line deprecate/import
import { mount } from 'enzyme';
import maplibregl from 'maplibre-gl';
import { act } from 'react-dom/test-utils';
import {
    Beacon,
    Room,
    RoomMember,
    MatrixEvent,
    getBeaconInfoIdentifier,
} from 'matrix-js-sdk/src/matrix';

import BeaconMarker from '../../../../src/components/views/beacon/BeaconMarker';
import MatrixClientContext from '../../../../src/contexts/MatrixClientContext';
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeRoomWithStateEvents,
} from '../../../test-utils';
import { TILE_SERVER_WK_KEY } from '../../../../src/utils/WellKnownUtils';

describe('<BeaconMarker />', () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    // stable date for snapshots
    jest.spyOn(global.Date, 'now').mockReturnValue(now);
    const roomId = '!room:server';
    const aliceId = '@alice:server';

    const aliceMember = new RoomMember(roomId, aliceId);

    const mockMap = new maplibregl.Map();

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
    const notLiveEvent = makeBeaconInfoEvent(aliceId,
        roomId,
        { isLive: false },
        '$alice-room1-2',
    );

    const location1 = makeBeaconEvent(
        aliceId, { beaconInfoId: defaultEvent.getId(), geoUri: 'geo:51,41', timestamp: now + 1 },
    );
    const location2 = makeBeaconEvent(
        aliceId, { beaconInfoId: defaultEvent.getId(), geoUri: 'geo:52,42', timestamp: now + 10000 },
    );

    const defaultProps = {
        map: mockMap,
        beacon: new Beacon(defaultEvent),
    };

    const getComponent = (props = {}) =>
        mount(<BeaconMarker {...defaultProps} {...props} />, {
            wrappingComponent: MatrixClientContext.Provider,
            wrappingComponentProps: { value: mockClient },
        });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders nothing when beacon is not live', () => {
        const room = setupRoom([notLiveEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(notLiveEvent));
        const component = getComponent({ beacon });
        expect(component.html()).toBe(null);
    });

    it('renders nothing when beacon has no location', () => {
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        const component = getComponent({ beacon });
        expect(component.html()).toBe(null);
    });

    it('renders marker when beacon has location', () => {
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        const component = getComponent({ beacon });
        expect(component).toMatchSnapshot();
    });

    it('updates with new locations', () => {
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon.addLocations([location1]);
        const component = getComponent({ beacon });
        expect(component.find('SmartMarker').props()['geoUri']).toEqual('geo:51,41');

        act(() => {
            beacon.addLocations([location2]);
        });
        component.setProps({});

        // updated to latest location
        expect(component.find('SmartMarker').props()['geoUri']).toEqual('geo:52,42');
    });
});
