/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room, type RoomState } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { mkEvent, mkMessage, mkRoom, stubClient } from "../../../../../test-utils";
import { getLastTimestamp } from "../../../../../../src/stores/room-list-v3/skip-list/sorters/utils/getLastTimestamp";

describe("getLastTimestamp", () => {
    it("should return last timestamp", () => {
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

    it("should return timestamp of membership event if user not joined to room", () => {
        const cli = stubClient();
        const room = mkRoom(cli, "!new:example.org");
        // Mock a membership event
        jest.spyOn(room.getLiveTimeline(), "getState").mockImplementation((_) => {
            return {
                getStateEvents: () =>
                    mkEvent({
                        type: "m.room.member",
                        user: "@john:matrix.org",
                        content: {},
                        ts: 500,
                        event: true,
                    }),
            } as unknown as RoomState;
        });
        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Invite);
        expect(getLastTimestamp(room, "@john:matrix.org")).toBe(500);
    });

    it("should return bump stamp when using sliding sync", () => {
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

        jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
        jest.spyOn(room, "getBumpStamp").mockReturnValue(314);
        room.addLiveEvents([event1, event2], { addToState: true });
        expect(getLastTimestamp(room, "@john:matrix.org")).toBe(314);
    });

    describe("membership event special cases", () => {
        it("should consider event if membership has changed", () => {
            const cli = stubClient();
            const room = new Room("room123", cli, "@john:matrix.org");

            const event1 = mkMessage({
                room: room.roomId,
                msg: "Hello world!",
                user: "@alice:matrix.org",
                ts: 5,
                event: true,
            });
            // Display name change that should be ignored during timestamp calculation
            const event2 = mkEvent({
                type: "m.room.member",
                user: "@john:matrix.org",
                content: {
                    membership: "leave",
                },
                prev_content: {
                    membership: "join",
                },
                ts: 400,
                event: true,
            });

            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
            room.addLiveEvents([event1, event2], { addToState: true });

            expect(getLastTimestamp(room, "@john:matrix.org")).toBe(400);
        });

        it("should skip display name changes", () => {
            const cli = stubClient();
            const room = new Room("room123", cli, "@john:matrix.org");

            const event1 = mkMessage({
                room: room.roomId,
                msg: "Hello world!",
                user: "@alice:matrix.org",
                ts: 5,
                event: true,
            });
            // Display name change that should be ignored during timestamp calculation
            const event2 = mkEvent({
                type: "m.room.member",
                user: "@john:matrix.org",
                content: {
                    displayname: "bar",
                },
                prev_content: {
                    displayname: "foo",
                },
                ts: 500,
                event: true,
            });

            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
            room.addLiveEvents([event1, event2], { addToState: true });

            expect(getLastTimestamp(room, "@john:matrix.org")).toBe(5);
        });

        it("should skip avatar changes", () => {
            const cli = stubClient();
            const room = new Room("room123", cli, "@john:matrix.org");

            const event1 = mkMessage({
                room: room.roomId,
                msg: "Hello world!",
                user: "@alice:matrix.org",
                ts: 5,
                event: true,
            });
            // Avatar url change that should be ignored during timestamp calculation
            const event2 = mkEvent({
                type: "m.room.member",
                user: "@john:matrix.org",
                content: {
                    avatar_url: "bar",
                },
                prev_content: {
                    avatar_url: "foo",
                },
                ts: 500,
                event: true,
            });

            jest.spyOn(room, "getMyMembership").mockReturnValue(KnownMembership.Join);
            room.addLiveEvents([event1, event2], { addToState: true });

            expect(getLastTimestamp(room, "@john:matrix.org")).toBe(5);
        });
    });
});
