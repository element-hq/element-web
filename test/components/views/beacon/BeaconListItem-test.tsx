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

import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { Beacon, RoomMember, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { LocationAssetType } from "matrix-js-sdk/src/@types/location";

import BeaconListItem from "../../../../src/components/views/beacon/BeaconListItem";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeRoomWithBeacons,
} from "../../../test-utils";

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

describe("<BeaconListItem />", () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    // go back in time to create beacons and locations in the past
    jest.spyOn(global.Date, "now").mockReturnValue(now - 600000);
    const roomId = "!room:server";
    const aliceId = "@alice:server";

    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(aliceId),
        getRoom: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
    });

    const aliceBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-1");
    const alicePinBeaconEvent = makeBeaconInfoEvent(
        aliceId,
        roomId,
        { isLive: true, assetType: LocationAssetType.Pin, description: "Alice's car" },
        "$alice-room1-1",
    );
    const pinBeaconWithoutDescription = makeBeaconInfoEvent(
        aliceId,
        roomId,
        { isLive: true, assetType: LocationAssetType.Pin },
        "$alice-room1-1",
    );

    const aliceLocation1 = makeBeaconEvent(aliceId, {
        beaconInfoId: aliceBeaconEvent.getId(),
        geoUri: "geo:51,41",
        timestamp: now - 1,
    });
    const aliceLocation2 = makeBeaconEvent(aliceId, {
        beaconInfoId: aliceBeaconEvent.getId(),
        geoUri: "geo:52,42",
        timestamp: now - 500000,
    });

    const defaultProps = {
        beacon: new Beacon(aliceBeaconEvent),
    };

    const getComponent = (props = {}) =>
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <BeaconListItem {...defaultProps} {...props} />
            </MatrixClientContext.Provider>,
        );

    const setupRoomWithBeacons = (beaconInfoEvents: MatrixEvent[], locationEvents?: MatrixEvent[]): Beacon[] => {
        const beacons = makeRoomWithBeacons(roomId, mockClient, beaconInfoEvents, locationEvents);

        const member = new RoomMember(roomId, aliceId);
        member.name = `Alice`;
        const room = mockClient.getRoom(roomId)!;
        jest.spyOn(room, "getMember").mockReturnValue(member);

        return beacons;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, "now").mockReturnValue(now);
    });

    it("renders null when beacon is not live", () => {
        const notLiveBeacon = makeBeaconInfoEvent(aliceId, roomId, { isLive: false });
        const [beacon] = setupRoomWithBeacons([notLiveBeacon]);
        const { container } = getComponent({ beacon });
        expect(container.innerHTML).toBeFalsy();
    });

    it("renders null when beacon has no location", () => {
        const [beacon] = setupRoomWithBeacons([aliceBeaconEvent]);
        const { container } = getComponent({ beacon });
        expect(container.innerHTML).toBeFalsy();
    });

    describe("when a beacon is live and has locations", () => {
        it("renders beacon info", () => {
            const [beacon] = setupRoomWithBeacons([alicePinBeaconEvent], [aliceLocation1]);
            const { asFragment } = getComponent({ beacon });
            expect(asFragment()).toMatchSnapshot();
        });

        describe("non-self beacons", () => {
            it("uses beacon description as beacon name", () => {
                const [beacon] = setupRoomWithBeacons([alicePinBeaconEvent], [aliceLocation1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_BeaconStatus_label")).toHaveTextContent("Alice's car");
            });

            it("uses beacon owner mxid as beacon name for a beacon without description", () => {
                const [beacon] = setupRoomWithBeacons([pinBeaconWithoutDescription], [aliceLocation1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_BeaconStatus_label")).toHaveTextContent(aliceId);
            });

            it("renders location icon", () => {
                const [beacon] = setupRoomWithBeacons([alicePinBeaconEvent], [aliceLocation1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_StyledLiveBeaconIcon")).toBeTruthy();
            });
        });

        describe("self locations", () => {
            it("renders beacon owner avatar", () => {
                const [beacon] = setupRoomWithBeacons([aliceBeaconEvent], [aliceLocation1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_BaseAvatar")).toBeTruthy();
            });

            it("uses beacon owner name as beacon name", () => {
                const [beacon] = setupRoomWithBeacons([aliceBeaconEvent], [aliceLocation1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_BeaconStatus_label")).toHaveTextContent("Alice");
            });
        });

        describe("on location updates", () => {
            it("updates last updated time on location updated", () => {
                const [beacon] = setupRoomWithBeacons([aliceBeaconEvent], [aliceLocation2]);
                const { container } = getComponent({ beacon });

                expect(container.querySelector(".mx_BeaconListItem_lastUpdated")).toHaveTextContent(
                    "Updated 9 minutes ago",
                );

                // update to a newer location
                act(() => {
                    beacon.addLocations([aliceLocation1]);
                });

                expect(container.querySelector(".mx_BeaconListItem_lastUpdated")).toHaveTextContent(
                    "Updated a few seconds ago",
                );
            });
        });

        describe("interactions", () => {
            it("does not call onClick handler when clicking share button", () => {
                const [beacon] = setupRoomWithBeacons([alicePinBeaconEvent], [aliceLocation1]);
                const onClick = jest.fn();
                const { getByTestId } = getComponent({ beacon, onClick });

                fireEvent.click(getByTestId("open-location-in-osm"));
                expect(onClick).not.toHaveBeenCalled();
            });

            it("calls onClick handler when clicking outside of share buttons", () => {
                const [beacon] = setupRoomWithBeacons([alicePinBeaconEvent], [aliceLocation1]);
                const onClick = jest.fn();
                const { container } = getComponent({ beacon, onClick });

                // click the beacon name
                fireEvent.click(container.querySelector(".mx_BeaconStatus_description")!);
                expect(onClick).toHaveBeenCalled();
            });
        });
    });
});
