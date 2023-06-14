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

import React, { ComponentProps } from "react";
import { act, fireEvent, render } from "@testing-library/react";

import DialogSidebar from "../../../../src/components/views/beacon/DialogSidebar";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeRoomWithBeacons,
    mockClientMethodsUser,
} from "../../../test-utils";

// Fake random strings to give a predictable snapshot for IDs
jest.mock("matrix-js-sdk/src/randomstring", () => ({
    randomString: () => "abdefghi",
}));

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
            );
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
