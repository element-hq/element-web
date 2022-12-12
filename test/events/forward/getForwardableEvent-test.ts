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

import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { getForwardableEvent } from "../../../src/events";
import {
    getMockClientWithEventEmitter,
    makeBeaconEvent,
    makeBeaconInfoEvent,
    makePollStartEvent,
    makeRoomWithBeacons,
} from "../../test-utils";

describe("getForwardableEvent()", () => {
    const userId = "@alice:server.org";
    const roomId = "!room:server.org";
    const client = getMockClientWithEventEmitter({
        getRoom: jest.fn(),
    });

    it("returns the event for a room message", () => {
        const alicesMessageEvent = new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            room_id: roomId,
            content: {
                msgtype: MsgType.Text,
                body: "Hello",
            },
        });

        expect(getForwardableEvent(alicesMessageEvent, client)).toBe(alicesMessageEvent);
    });

    it("returns null for a poll start event", () => {
        const pollStartEvent = makePollStartEvent("test?", userId);

        expect(getForwardableEvent(pollStartEvent, client)).toBe(null);
    });

    describe("beacons", () => {
        it("returns null for a beacon that is not live", () => {
            const notLiveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: false });
            makeRoomWithBeacons(roomId, client, [notLiveBeacon]);

            expect(getForwardableEvent(notLiveBeacon, client)).toBe(null);
        });

        it("returns null for a live beacon that does not have a location", () => {
            const liveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: true });
            makeRoomWithBeacons(roomId, client, [liveBeacon]);

            expect(getForwardableEvent(liveBeacon, client)).toBe(null);
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

            expect(getForwardableEvent(liveBeacon, client)).toBe(locationEvent);
        });
    });
});
