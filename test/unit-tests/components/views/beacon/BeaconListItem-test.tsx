/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, fireEvent, render } from "jest-matrix-react";
import { Beacon, RoomMember, MatrixEvent, LocationAssetType } from "matrix-js-sdk/src/matrix";

import BeaconListItem from "../../../../../src/components/views/beacon/BeaconListItem";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeRoomWithBeacons,
} from "../../../../test-utils";

describe("<BeaconListItem />", () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    // go back in time to create beacons and locations in the past
    jest.spyOn(global.Date, "now").mockReturnValue(now - 600000);
    const roomId = "!room:server";
    const <alice>Id = "@<alice>:server";

    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(<alice>Id),
        getRoom: jest.fn(),
        isGuest: jest.fn().mockReturnValue(false),
    });

    const <alice>BeaconEvent = makeBeaconInfoEvent(<alice>Id, roomId, { isLive: true }, "$<alice>-room1-1");
    const <alice>PinBeaconEvent = makeBeaconInfoEvent(
        <alice>Id,
        roomId,
        { isLive: true, assetType: LocationAssetType.Pin, description: "<alice>'s car" },
        "$<alice>-room1-1",
    );
    const pinBeaconWithoutDescription = makeBeaconInfoEvent(
        <alice>Id,
        roomId,
        { isLive: true, assetType: LocationAssetType.Pin },
        "$<alice>-room1-1",
    );

    const <alice>Location1 = makeBeaconEvent(<alice>Id, {
        beaconInfoId: <alice>BeaconEvent.getId(),
        geoUri: "geo:51,41",
        timestamp: now - 1,
    });
    const <alice>Location2 = makeBeaconEvent(<alice>Id, {
        beaconInfoId: <alice>BeaconEvent.getId(),
        geoUri: "geo:52,42",
        timestamp: now - 500000,
    });

    const defaultProps = {
        beacon: new Beacon(<alice>BeaconEvent),
    };

    const getComponent = (props = {}) =>
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <BeaconListItem {...defaultProps} {...props} />
            </MatrixClientContext.Provider>,
        );

    const setupRoomWithBeacons = (beaconInfoEvents: MatrixEvent[], locationEvents?: MatrixEvent[]): Beacon[] => {
        const beacons = makeRoomWithBeacons(roomId, mockClient, beaconInfoEvents, locationEvents);

        const member = new RoomMember(roomId, <alice>Id);
        member.name = `<alice>`;
        const room = mockClient.getRoom(roomId)!;
        jest.spyOn(room, "getMember").mockReturnValue(member);

        return beacons;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(Date, "now").mockReturnValue(now);
    });

    it("renders null when beacon is not live", () => {
        const notLiveBeacon = makeBeaconInfoEvent(<alice>Id, roomId, { isLive: false });
        const [beacon] = setupRoomWithBeacons([notLiveBeacon]);
        const { container } = getComponent({ beacon });
        expect(container.innerHTML).toBeFalsy();
    });

    it("renders null when beacon has no location", () => {
        const [beacon] = setupRoomWithBeacons([<alice>BeaconEvent]);
        const { container } = getComponent({ beacon });
        expect(container.innerHTML).toBeFalsy();
    });

    describe("when a beacon is live and has locations", () => {
        it("renders beacon info", () => {
            const [beacon] = setupRoomWithBeacons([<alice>PinBeaconEvent], [<alice>Location1]);
            const { asFragment } = getComponent({ beacon });
            expect(asFragment()).toMatchSnapshot();
        });

        describe("non-self beacons", () => {
            it("uses beacon description as beacon name", () => {
                const [beacon] = setupRoomWithBeacons([<alice>PinBeaconEvent], [<alice>Location1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_BeaconStatus_label")).toHaveTextContent("<alice>'s car");
            });

            it("uses beacon owner mxid as beacon name for a beacon without description", () => {
                const [beacon] = setupRoomWithBeacons([pinBeaconWithoutDescription], [<alice>Location1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_BeaconStatus_label")).toHaveTextContent(<alice>Id);
            });

            it("renders location icon", () => {
                const [beacon] = setupRoomWithBeacons([<alice>PinBeaconEvent], [<alice>Location1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_StyledLiveBeaconIcon")).toBeTruthy();
            });
        });

        describe("self locations", () => {
            it("renders beacon owner avatar", () => {
                const [beacon] = setupRoomWithBeacons([<alice>BeaconEvent], [<alice>Location1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_BaseAvatar")).toBeTruthy();
            });

            it("uses beacon owner name as beacon name", () => {
                const [beacon] = setupRoomWithBeacons([<alice>BeaconEvent], [<alice>Location1]);
                const { container } = getComponent({ beacon });
                expect(container.querySelector(".mx_BeaconStatus_label")).toHaveTextContent("<alice>");
            });
        });

        describe("on location updates", () => {
            it("updates last updated time on location updated", () => {
                const [beacon] = setupRoomWithBeacons([<alice>BeaconEvent], [<alice>Location2]);
                const { container } = getComponent({ beacon });

                expect(container.querySelector(".mx_BeaconListItem_lastUpdated")).toHaveTextContent(
                    "Updated 9 minutes ago",
                );

                // update to a newer location
                act(() => {
                    beacon.addLocations([<alice>Location1]);
                });

                expect(container.querySelector(".mx_BeaconListItem_lastUpdated")).toHaveTextContent(
                    "Updated a few seconds ago",
                );
            });
        });

        describe("interactions", () => {
            it("does not call onClick handler when clicking share button", () => {
                const [beacon] = setupRoomWithBeacons([<alice>PinBeaconEvent], [<alice>Location1]);
                const onClick = jest.fn();
                const { getByTestId } = getComponent({ beacon, onClick });

                fireEvent.click(getByTestId("open-location-in-osm"));
                expect(onClick).not.toHaveBeenCalled();
            });

            it("calls onClick handler when clicking outside of share buttons", () => {
                const [beacon] = setupRoomWithBeacons([<alice>PinBeaconEvent], [<alice>Location1]);
                const onClick = jest.fn();
                const { container } = getComponent({ beacon, onClick });

                // click the beacon name
                fireEvent.click(container.querySelector(".mx_BeaconStatus_description")!);
                expect(onClick).toHaveBeenCalled();
            });
        });
    });
});
