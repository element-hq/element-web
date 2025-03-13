/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { getShareableLocationEvent } from "../../../../src/events";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makeLocationEvent,
    makeRoomWithBeacons,
} from "../../../test-utils";

describe("getShareableLocationEvent()", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const client = getMockClientWithEventEmitter({
        getRoom: jest.fn(),
    });

    it("returns null for a non-location event", () => {
        const alicesMessageEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            room_id: roomId,
            content: {
                msgtype: MsgType.Text,
                body: "Hello",
            },
        });

        expect(getShareableLocationEvent(alicesMessageEvent, client)).toBe(null);
    });

    it("returns the event for a location event", () => {
        const locationEvent = makeLocationEvent("geo:52,42");

        expect(getShareableLocationEvent(locationEvent, client)).toBe(locationEvent);
    });

    describe("beacons", () => {
        it("returns null for a beacon that is not live", () => {
            const notLiveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: false });
            makeRoomWithBeacons(roomId, client, [notLiveBeacon]);

            expect(getShareableLocationEvent(notLiveBeacon, client)).toBe(null);
        });

        it("returns null for a live beacon that does not have a location", () => {
            const liveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: true });
            makeRoomWithBeacons(roomId, client, [liveBeacon]);

            expect(getShareableLocationEvent(liveBeacon, client)).toBe(null);
        });

        it("returns the latest location event for a live beacon with location", () => {
            const liveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: true }, "id");
            const locationEvent = makeBeaconEvent(userId, {
                beaconInfoId: liveBeacon.getId(),
                geoUri: "geo:52,42",
                // make sure its in live period
                timestamp: Date.now() + 1,
            });
            makeRoomWithBeacons(roomId, client, [liveBeacon], [locationEvent]);

            expect(getShareableLocationEvent(liveBeacon, client)).toBe(locationEvent);
        });
    });
});
