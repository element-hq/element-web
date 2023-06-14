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

import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { shouldDisplayAsBeaconTile } from "../../../src/utils/beacon/timeline";
import { makeBeaconInfoEvent } from "../../test-utils";

describe("shouldDisplayAsBeaconTile", () => {
    const userId = "@user:server";
    const roomId = "!room:server";
    const liveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: true });
    const notLiveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: false });
    const memberEvent = new MatrixEvent({ type: EventType.RoomMember });
    const redactedBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: false });
    redactedBeacon.makeRedacted(redactedBeacon);

    it("returns true for a beacon with live property set to true", () => {
        expect(shouldDisplayAsBeaconTile(liveBeacon)).toBe(true);
    });

    it("returns true for a redacted beacon", () => {
        expect(shouldDisplayAsBeaconTile(redactedBeacon)).toBe(true);
    });

    it("returns false for a beacon with live property set to false", () => {
        expect(shouldDisplayAsBeaconTile(notLiveBeacon)).toBe(false);
    });

    it("returns false for a non beacon event", () => {
        expect(shouldDisplayAsBeaconTile(memberEvent)).toBe(false);
    });
});
