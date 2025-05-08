/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { act, fireEvent, render } from "jest-matrix-react";

import DialogSidebar from "../../../../../src/components/views/beacon/DialogSidebar";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeRoomWithBeacons,
    mockClientMethodsUser,
} from "../../../../test-utils";

describe("<DialogSidebar />", () => {
    const defaultProps: ComponentProps<typeof DialogSidebar> = {
        beacons: [],
        requestClose: jest.fn(),
        onBeaconClick: jest.fn(),
    };

    const now = 1647270879403;

    const roomId = "!room:server.org";
    const aliceId = "@alice:server.org";
    const client = getMockClientWithEventEmitter({
        ...mockClientMethodsUser(aliceId),
        getRoom: jest.fn(),
    });

    const beaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true, timestamp: now }, "$alice-room1-1");
    const location1 = makeBeaconEvent(aliceId, {
        beaconInfoId: beaconEvent.getId(),
        geoUri: "geo:51,41",
        timestamp: now,
    });

    const getComponent = (props = {}) => (
        <MatrixClientContext.Provider value={client}>
            <DialogSidebar {...defaultProps} {...props} />
        </MatrixClientContext.Provider>
    );

    beforeEach(() => {
        // mock now so time based text in snapshots is stable
        jest.spyOn(Date, "now").mockReturnValue(now);
    });

    afterAll(() => {
        jest.spyOn(Date, "now").mockRestore();
    });

    it("renders sidebar correctly without beacons", () => {
        const { container } = render(getComponent());
        expect(container).toMatchSnapshot();
    });

    it("renders sidebar correctly with beacons", () => {
        const [beacon] = makeRoomWithBeacons(roomId, client, [beaconEvent], [location1]);
        const { container } = render(getComponent({ beacons: [beacon] }));
        expect(container).toMatchSnapshot();
    });

    it("calls on beacon click", () => {
        const onBeaconClick = jest.fn();
        const [beacon] = makeRoomWithBeacons(roomId, client, [beaconEvent], [location1]);
        const { container } = render(getComponent({ beacons: [beacon], onBeaconClick }));

        act(() => {
            const [listItem] = container.getElementsByClassName("mx_BeaconListItem");
            fireEvent.click(listItem);
        });

        expect(onBeaconClick).toHaveBeenCalled();
    });

    it("closes on close button click", () => {
        const requestClose = jest.fn();
        const { getByTestId } = render(getComponent({ requestClose }));

        act(() => {
            fireEvent.click(getByTestId("dialog-sidebar-close"));
        });
        expect(requestClose).toHaveBeenCalled();
    });
});
