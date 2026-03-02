/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render, screen, waitFor } from "jest-matrix-react";
import * as maplibregl from "maplibre-gl";
import { Beacon, type Room, RoomMember, type MatrixEvent, getBeaconInfoIdentifier } from "matrix-js-sdk/src/matrix";

import BeaconMarker from "../../../../../src/components/views/beacon/BeaconMarker";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeRoomWithStateEvents,
} from "../../../../test-utils";
import { TILE_SERVER_WK_KEY } from "../../../../../src/utils/WellKnownUtils";

describe("<BeaconMarker />", () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    // stable date for snapshots
    jest.spyOn(global.Date, "now").mockReturnValue(now);
    const roomId = "!room:server";
    const aliceId = "@alice:server";

    const aliceMember = new RoomMember(roomId, aliceId);

    const mapOptions = { container: {} as unknown as HTMLElement, style: "" };
    const mockMap = new maplibregl.Map(mapOptions);
    const mockMarker = new maplibregl.Marker();

    const mockClient = getMockClientWithEventEmitter({
        getClientWellKnown: jest.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        }),
        getUserId: jest.fn().mockReturnValue(aliceId),
        getRoom: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
    });

    // make fresh rooms every time
    // as we update room state
    const setupRoom = (stateEvents: MatrixEvent[] = []): Room => {
        const room1 = makeRoomWithStateEvents(stateEvents, { roomId, mockClient });
        jest.spyOn(room1, "getMember").mockReturnValue(aliceMember);
        return room1;
    };

    const defaultEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-1");
    const notLiveEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: false }, "$alice-room1-2");

    const geoUri1 = "geo:51,41";
    const location1 = makeBeaconEvent(aliceId, {
        beaconInfoId: defaultEvent.getId(),
        geoUri: geoUri1,
        timestamp: now + 1,
    });
    const geoUri2 = "geo:52,42";
    const location2 = makeBeaconEvent(aliceId, {
        beaconInfoId: defaultEvent.getId(),
        geoUri: geoUri2,
        timestamp: now + 10000,
    });

    const defaultProps = {
        map: mockMap,
        beacon: new Beacon(defaultEvent),
    };

    const renderComponent = (props = {}) => {
        const Wrapper = (wrapperProps = {}) => {
            return <MatrixClientContext.Provider value={mockClient} {...wrapperProps} />;
        };

        return render(<BeaconMarker {...defaultProps} {...props} />, {
            wrapper: Wrapper,
        });
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders nothing when beacon is not live", () => {
        const room = setupRoom([notLiveEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(notLiveEvent));
        const { asFragment } = renderComponent({ beacon });
        expect(asFragment()).toMatchInlineSnapshot(`<DocumentFragment />`);
        expect(screen.queryByTestId("avatar-img")).not.toBeInTheDocument();
    });

    it("renders nothing when beacon has no location", () => {
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        const { asFragment } = renderComponent({ beacon });
        expect(asFragment()).toMatchInlineSnapshot(`<DocumentFragment />`);
        expect(screen.queryByTestId("avatar-img")).not.toBeInTheDocument();
    });

    it("renders marker when beacon has location", async () => {
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon?.addLocations([location1]);
        const { asFragment } = renderComponent({ beacon });
        await waitFor(() => {
            expect(screen.getByTestId("avatar-img")).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();
    });

    it("updates with new locations", () => {
        const lonLat1 = { lon: 41, lat: 51 };
        const lonLat2 = { lon: 42, lat: 52 };
        const room = setupRoom([defaultEvent]);
        const beacon = room.currentState.beacons.get(getBeaconInfoIdentifier(defaultEvent));
        beacon?.addLocations([location1]);

        // render the component then add a new location, check mockMarker called as expected
        renderComponent({ beacon });
        expect(mockMarker.setLngLat).toHaveBeenLastCalledWith(lonLat1);
        expect(mockMarker.addTo).toHaveBeenCalledWith(mockMap);

        // add a location, check mockMarker called with new location details
        act(() => {
            beacon?.addLocations([location2]);
        });
        expect(mockMarker.setLngLat).toHaveBeenLastCalledWith(lonLat2);
        expect(mockMarker.addTo).toHaveBeenCalledWith(mockMap);
    });
});
