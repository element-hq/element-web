/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";

import { shouldDisplayAsBeaconTile } from "../../../../src/utils/beacon/timeline";
import { makeBeaconInfoEvent, stubClient } from "../../../test-utils";

describe("shouldDisplayAsBeaconTile", () => {
    const userId = "@user:server";
    const roomId = "!room:server";
    const liveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: true });
    const notLiveBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: false });
    const memberEvent = new MatrixEvent({ type: EventType.RoomMember });
    const redactedBeacon = makeBeaconInfoEvent(userId, roomId, { isLive: false });
    redactedBeacon.makeRedacted(redactedBeacon, new Room(roomId, stubClient(), userId));

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
