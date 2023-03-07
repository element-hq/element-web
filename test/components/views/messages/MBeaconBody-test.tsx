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
import * as maplibregl from "maplibre-gl";
import { BeaconEvent, getBeaconInfoIdentifier, RelationType, MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { Relations } from "matrix-js-sdk/src/models/relations";
import { M_BEACON } from "matrix-js-sdk/src/@types/beacon";

import MBeaconBody from "../../../../src/components/views/messages/MBeaconBody";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeRoomWithBeacons,
    makeRoomWithStateEvents,
} from "../../../test-utils";
import { RoomPermalinkCreator } from "../../../../src/utils/permalinks/Permalinks";
import { MediaEventHelper } from "../../../../src/utils/MediaEventHelper";
import MatrixClientContext from "../../../../src/contexts/MatrixClientContext";
import Modal from "../../../../src/Modal";
import { TILE_SERVER_WK_KEY } from "../../../../src/utils/WellKnownUtils";
import * as mapUtilHooks from "../../../../src/utils/location/useMap";
import { LocationShareError } from "../../../../src/utils/location";

describe("<MBeaconBody />", () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    // stable date for snapshots
    jest.spyOn(global.Date, "now").mockReturnValue(now);
    const roomId = "!room:server";
    const aliceId = "@alice:server";

    const mapOptions = { container: {} as unknown as HTMLElement, style: "" };
    const mockMap = new maplibregl.Map(mapOptions);
    const mockMarker = new maplibregl.Marker();

    const mockClient = getMockClientWithEventEmitter({
        getClientWellKnown: jest.fn().mockReturnValue({
            [TILE_SERVER_WK_KEY.name]: { map_style_url: "maps.com" },
        }),
        getUserId: jest.fn().mockReturnValue(aliceId),
        getRoom: jest.fn(),
        redactEvent: jest.fn(),
    });

    const defaultEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-1");

    const defaultProps: ComponentProps<typeof MBeaconBody> = {
        mxEvent: defaultEvent,
        highlights: [],
        highlightLink: "",
        onHeightChanged: jest.fn(),
        onMessageAllowed: jest.fn(),
        // we dont use these and they pollute the snapshots
        permalinkCreator: {} as unknown as RoomPermalinkCreator,
        mediaEventHelper: {} as unknown as MediaEventHelper,
    };

    const getComponent = (props = {}) =>
        render(
            <MatrixClientContext.Provider value={mockClient}>
                <MBeaconBody {...defaultProps} {...props} />
            </MatrixClientContext.Provider>,
        );

    const modalSpy = jest.spyOn(Modal, "createDialog").mockReturnValue({
        finished: Promise.resolve([true]),
        close: () => {},
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const testBeaconStatuses = () => {
        it("renders stopped beacon UI for an explicitly stopped beacon", () => {
            const beaconInfoEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: false }, "$alice-room1-1");
            makeRoomWithStateEvents([beaconInfoEvent], { roomId, mockClient });
            const component = getComponent({ mxEvent: beaconInfoEvent });
            expect(component.container).toHaveTextContent("Live location ended");
        });

        it("renders stopped beacon UI for an expired beacon", () => {
            const beaconInfoEvent = makeBeaconInfoEvent(
                aliceId,
                roomId,
                // puts this beacons live period in the past
                { isLive: true, timestamp: now - 600000, timeout: 500 },
                "$alice-room1-1",
            );
            makeRoomWithStateEvents([beaconInfoEvent], { roomId, mockClient });
            const component = getComponent({ mxEvent: beaconInfoEvent });
            expect(component.container).toHaveTextContent("Live location ended");
        });

        it("renders loading beacon UI for a beacon that has not started yet", () => {
            const beaconInfoEvent = makeBeaconInfoEvent(
                aliceId,
                roomId,
                // puts this beacons start timestamp in the future
                { isLive: true, timestamp: now + 60000, timeout: 500 },
                "$alice-room1-1",
            );
            makeRoomWithStateEvents([beaconInfoEvent], { roomId, mockClient });
            const component = getComponent({ mxEvent: beaconInfoEvent });
            expect(component.container).toHaveTextContent("Loading live location…");
        });

        it("does not open maximised map when on click when beacon is stopped", () => {
            const beaconInfoEvent = makeBeaconInfoEvent(
                aliceId,
                roomId,
                // puts this beacons live period in the past
                { isLive: true, timestamp: now - 600000, timeout: 500 },
                "$alice-room1-1",
            );
            makeRoomWithStateEvents([beaconInfoEvent], { roomId, mockClient });
            const component = getComponent({ mxEvent: beaconInfoEvent });
            fireEvent.click(component.container.querySelector(".mx_MBeaconBody_map")!);

            expect(modalSpy).not.toHaveBeenCalled();
        });

        it("renders stopped UI when a beacon event is not the latest beacon for a user", () => {
            const aliceBeaconInfo1 = makeBeaconInfoEvent(
                aliceId,
                roomId,
                // this one is a little older
                { isLive: true, timestamp: now - 500 },
                "$alice-room1-1",
            );
            aliceBeaconInfo1.event.origin_server_ts = now - 500;
            const aliceBeaconInfo2 = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-2");

            makeRoomWithStateEvents([aliceBeaconInfo1, aliceBeaconInfo2], { roomId, mockClient });

            const component = getComponent({ mxEvent: aliceBeaconInfo1 });
            // beacon1 has been superceded by beacon2
            expect(component.container).toHaveTextContent("Live location ended");
        });

        it("renders stopped UI when a beacon event is replaced", () => {
            const aliceBeaconInfo1 = makeBeaconInfoEvent(
                aliceId,
                roomId,
                // this one is a little older
                { isLive: true, timestamp: now - 500 },
                "$alice-room1-1",
            );
            aliceBeaconInfo1.event.origin_server_ts = now - 500;
            const aliceBeaconInfo2 = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-2");

            const room = makeRoomWithStateEvents([aliceBeaconInfo1], { roomId, mockClient });
            const component = getComponent({ mxEvent: aliceBeaconInfo1 });

            const beaconInstance = room.currentState.beacons.get(getBeaconInfoIdentifier(aliceBeaconInfo1))!;
            // update alice's beacon with a new edition
            // beacon instance emits
            act(() => {
                beaconInstance.update(aliceBeaconInfo2);
            });

            // beacon1 has been superceded by beacon2
            expect(component.container).toHaveTextContent("Live location ended");
        });
    };

    testBeaconStatuses();

    describe("on liveness change", () => {
        it("renders stopped UI when a beacon stops being live", () => {
            const aliceBeaconInfo = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-1");

            const room = makeRoomWithStateEvents([aliceBeaconInfo], { roomId, mockClient });
            const beaconInstance = room.currentState.beacons.get(getBeaconInfoIdentifier(aliceBeaconInfo))!;
            const component = getComponent({ mxEvent: aliceBeaconInfo });

            act(() => {
                // @ts-ignore cheat to force beacon to not live
                beaconInstance._isLive = false;
                beaconInstance.emit(BeaconEvent.LivenessChange, false, beaconInstance);
            });

            // stopped UI
            expect(component.container).toHaveTextContent("Live location ended");
        });
    });

    describe("latestLocationState", () => {
        const aliceBeaconInfo = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-1");

        const location1 = makeBeaconEvent(aliceId, {
            beaconInfoId: aliceBeaconInfo.getId(),
            geoUri: "geo:51,41",
            timestamp: now + 1,
        });
        const location2 = makeBeaconEvent(aliceId, {
            beaconInfoId: aliceBeaconInfo.getId(),
            geoUri: "geo:52,42",
            timestamp: now + 10000,
        });

        it("renders a live beacon without a location correctly", () => {
            makeRoomWithStateEvents([aliceBeaconInfo], { roomId, mockClient });
            const component = getComponent({ mxEvent: aliceBeaconInfo });

            expect(component.container).toHaveTextContent("Loading live location…");
        });

        it("does nothing on click when a beacon has no location", () => {
            makeRoomWithStateEvents([aliceBeaconInfo], { roomId, mockClient });
            const component = getComponent({ mxEvent: aliceBeaconInfo });

            fireEvent.click(component.container.querySelector(".mx_MBeaconBody_map")!);

            expect(modalSpy).not.toHaveBeenCalled();
        });

        it("renders a live beacon with a location correctly", () => {
            const room = makeRoomWithStateEvents([aliceBeaconInfo], { roomId, mockClient });
            const beaconInstance = room.currentState.beacons.get(getBeaconInfoIdentifier(aliceBeaconInfo))!;
            beaconInstance.addLocations([location1]);
            const component = getComponent({ mxEvent: aliceBeaconInfo });

            expect(component.container.querySelector(".maplibregl-canvas-container")).toBeDefined();
        });

        it("opens maximised map view on click when beacon has a live location", () => {
            const room = makeRoomWithStateEvents([aliceBeaconInfo], { roomId, mockClient });
            const beaconInstance = room.currentState.beacons.get(getBeaconInfoIdentifier(aliceBeaconInfo))!;
            beaconInstance.addLocations([location1]);
            const component = getComponent({ mxEvent: aliceBeaconInfo });

            fireEvent.click(component.container.querySelector(".mx_Map")!);

            // opens modal
            expect(modalSpy).toHaveBeenCalled();
        });

        it("updates latest location", () => {
            const room = makeRoomWithStateEvents([aliceBeaconInfo], { roomId, mockClient });
            getComponent({ mxEvent: aliceBeaconInfo });

            const beaconInstance = room.currentState.beacons.get(getBeaconInfoIdentifier(aliceBeaconInfo))!;
            act(() => {
                beaconInstance.addLocations([location1]);
            });

            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 51, lon: 41 });
            expect(mockMarker.setLngLat).toHaveBeenCalledWith({ lat: 51, lon: 41 });

            act(() => {
                beaconInstance.addLocations([location2]);
            });

            expect(mockMap.setCenter).toHaveBeenCalledWith({ lat: 52, lon: 42 });
            expect(mockMarker.setLngLat).toHaveBeenCalledWith({ lat: 52, lon: 42 });
        });
    });

    describe("redaction", () => {
        const makeEvents = (): {
            beaconInfoEvent: MatrixEvent;
            location1: MatrixEvent;
            location2: MatrixEvent;
        } => {
            const beaconInfoEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-1");

            const location1 = makeBeaconEvent(
                aliceId,
                { beaconInfoId: beaconInfoEvent.getId(), geoUri: "geo:51,41", timestamp: now + 1 },
                roomId,
            );
            location1.event.event_id = "1";
            const location2 = makeBeaconEvent(
                aliceId,
                { beaconInfoId: beaconInfoEvent.getId(), geoUri: "geo:52,42", timestamp: now + 10000 },
                roomId,
            );
            location2.event.event_id = "2";
            return { beaconInfoEvent, location1, location2 };
        };

        const redactionEvent = new MatrixEvent({ type: EventType.RoomRedaction, content: { reason: "test reason" } });

        const setupRoomWithBeacon = (beaconInfoEvent: MatrixEvent, locationEvents: MatrixEvent[] = []) => {
            const room = makeRoomWithStateEvents([beaconInfoEvent], { roomId, mockClient });
            const beaconInstance = room.currentState.beacons.get(getBeaconInfoIdentifier(beaconInfoEvent))!;
            beaconInstance.addLocations(locationEvents);
        };
        const mockGetRelationsForEvent = (locationEvents: MatrixEvent[] = []) => {
            const relations = new Relations(RelationType.Reference, M_BEACON.name, mockClient);
            jest.spyOn(relations, "getRelations").mockReturnValue(locationEvents);

            const getRelationsForEvent = jest.fn().mockReturnValue(relations);

            return getRelationsForEvent;
        };

        it("does nothing when getRelationsForEvent is falsy", () => {
            const { beaconInfoEvent, location1, location2 } = makeEvents();
            setupRoomWithBeacon(beaconInfoEvent, [location1, location2]);

            getComponent({ mxEvent: beaconInfoEvent });

            act(() => {
                beaconInfoEvent.makeRedacted(redactionEvent);
            });

            // no error, no redactions
            expect(mockClient.redactEvent).not.toHaveBeenCalled();
        });

        it("cleans up redaction listener on unmount", () => {
            const { beaconInfoEvent, location1, location2 } = makeEvents();
            setupRoomWithBeacon(beaconInfoEvent, [location1, location2]);
            const removeListenerSpy = jest.spyOn(beaconInfoEvent, "removeListener");

            const component = getComponent({ mxEvent: beaconInfoEvent });

            act(() => {
                component.unmount();
            });

            expect(removeListenerSpy).toHaveBeenCalled();
        });

        it("does nothing when beacon has no related locations", async () => {
            const { beaconInfoEvent } = makeEvents();
            // no locations
            setupRoomWithBeacon(beaconInfoEvent, []);
            const getRelationsForEvent = await mockGetRelationsForEvent();

            getComponent({ mxEvent: beaconInfoEvent, getRelationsForEvent });

            act(() => {
                beaconInfoEvent.makeRedacted(redactionEvent);
            });

            expect(getRelationsForEvent).toHaveBeenCalledWith(
                beaconInfoEvent.getId(),
                RelationType.Reference,
                M_BEACON.name,
            );
            expect(mockClient.redactEvent).not.toHaveBeenCalled();
        });

        it("redacts related locations on beacon redaction", async () => {
            const { beaconInfoEvent, location1, location2 } = makeEvents();
            setupRoomWithBeacon(beaconInfoEvent, [location1, location2]);

            const getRelationsForEvent = await mockGetRelationsForEvent([location1, location2]);

            getComponent({ mxEvent: beaconInfoEvent, getRelationsForEvent });

            act(() => {
                beaconInfoEvent.makeRedacted(redactionEvent);
            });

            expect(getRelationsForEvent).toHaveBeenCalledWith(
                beaconInfoEvent.getId(),
                RelationType.Reference,
                M_BEACON.name,
            );
            expect(mockClient.redactEvent).toHaveBeenCalledTimes(2);
            expect(mockClient.redactEvent).toHaveBeenCalledWith(roomId, location1.getId(), undefined, {
                reason: "test reason",
            });
            expect(mockClient.redactEvent).toHaveBeenCalledWith(roomId, location2.getId(), undefined, {
                reason: "test reason",
            });
        });
    });

    describe("when map display is not configured", () => {
        beforeEach(() => {
            // mock map utils to raise MapStyleUrlNotConfigured error
            jest.spyOn(mapUtilHooks, "useMap").mockImplementation(({ onError }) => {
                onError?.(new Error(LocationShareError.MapStyleUrlNotConfigured));
                return mockMap;
            });
        });

        it("renders maps unavailable error for a live beacon with location", () => {
            const beaconInfoEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true }, "$alice-room1-1");
            const location1 = makeBeaconEvent(aliceId, {
                beaconInfoId: beaconInfoEvent.getId(),
                geoUri: "geo:51,41",
                timestamp: now + 1,
            });

            makeRoomWithBeacons(roomId, mockClient, [beaconInfoEvent], [location1]);

            const component = getComponent({ mxEvent: beaconInfoEvent });
            expect(component.getByTestId("map-rendering-error")).toMatchSnapshot();
        });

        // test that statuses display as expected with a map display error
        testBeaconStatuses();
    });
});
