/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { mkMessage, mkRoom, stubClient } from "../../../../../test-utils";
import { getLastTimestamp } from "../../../../../../src/stores/room-list-v3/skip-list/sorters/utils/getLastTimestamp";

describe("getLastTs", () => {
    it("returns the last ts", () => {
        const cli = stubClient();
        const room = new Room("room123", cli, "@john:matrix.org");

        const event1 = mkMessage({
            room: room.roomId,
            msg: "Hello world!",
            user: "@alice:matrix.org",
            ts: 5,
            event: true,
        });
        const event2 = mkMessage({
            room: room.roomId,
            msg: "Howdy!",
            user: "@bob:matrix.org",
            ts: 10,
            event: true,
        });

        room.getMyMembership = () => KnownMembership.Join;

        room.addLiveEvents([event1], { addToState: true });
        expect(getLastTimestamp(room, "@jane:matrix.org")).toBe(5);
        expect(getLastTimestamp(room, "@john:matrix.org")).toBe(5);

        room.addLiveEvents([event2], { addToState: true });

        expect(getLastTimestamp(room, "@jane:matrix.org")).toBe(10);
        expect(getLastTimestamp(room, "@john:matrix.org")).toBe(10);
    });

    it("returns a fake ts for rooms without a timeline", () => {
        const cli = stubClient();
        const room = mkRoom(cli, "!new:example.org");
        // @ts-ignore
        room.timeline = undefined;
        expect(getLastTimestamp(room, "@john:matrix.org")).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("works when not a member", () => {
        const cli = stubClient();
        const room = mkRoom(cli, "!new:example.org");
        room.getMyMembership.mockReturnValue(KnownMembership.Invite);
        expect(getLastTimestamp(room, "@john:matrix.org")).toBe(0);
    });
});
