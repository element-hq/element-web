/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { mkMessage, mkRoom, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import "../../../../../src/stores/room-list/RoomListStore";
import { RecentAlgorithm } from "../../../../../src/stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import { makeThreadEvent, mkThread } from "../../../../test-utils/threads";
import { DefaultTagID } from "../../../../../src/stores/room-list/models";

describe("RecentAlgorithm", () => {
    let algorithm: RecentAlgorithm;
    let cli: MatrixClient;

    beforeEach(() => {
        stubClient();
        cli = MatrixClientPeg.safeGet();
        algorithm = new RecentAlgorithm();
    });

    describe("getLastTs", () => {
        it("returns the last ts", () => {
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
            expect(algorithm.getLastTs(room, "@jane:matrix.org")).toBe(5);
            expect(algorithm.getLastTs(room, "@john:matrix.org")).toBe(5);

            room.addLiveEvents([event2], { addToState: true });

            expect(algorithm.getLastTs(room, "@jane:matrix.org")).toBe(10);
            expect(algorithm.getLastTs(room, "@john:matrix.org")).toBe(10);
        });

        it("returns a fake ts for rooms without a timeline", () => {
            const room = mkRoom(cli, "!new:example.org");
            // @ts-ignore
            room.timeline = undefined;
            expect(algorithm.getLastTs(room, "@john:matrix.org")).toBe(Number.MAX_SAFE_INTEGER);
        });

        it("works when not a member", () => {
            const room = mkRoom(cli, "!new:example.org");
            room.getMyMembership.mockReturnValue(KnownMembership.Invite);
            expect(algorithm.getLastTs(room, "@john:matrix.org")).toBe(Number.MAX_SAFE_INTEGER);
        });
    });

    describe("sortRooms", () => {
        it("orders rooms per last message ts", () => {
            const room1 = new Room("room1", cli, "@bob:matrix.org");
            const room2 = new Room("room2", cli, "@bob:matrix.org");

            room1.getMyMembership = () => KnownMembership.Join;
            room2.getMyMembership = () => KnownMembership.Join;

            const evt = mkMessage({
                room: room1.roomId,
                msg: "Hello world!",
                user: "@alice:matrix.org",
                ts: 5,
                event: true,
            });
            const evt2 = mkMessage({
                room: room2.roomId,
                msg: "Hello world!",
                user: "@alice:matrix.org",
                ts: 2,
                event: true,
            });

            room1.addLiveEvents([evt], { addToState: true });
            room2.addLiveEvents([evt2], { addToState: true });

            expect(algorithm.sortRooms([room2, room1], DefaultTagID.Untagged)).toEqual([room1, room2]);
        });

        it("orders rooms without messages first", () => {
            const room1 = new Room("room1", cli, "@bob:matrix.org");
            const room2 = new Room("room2", cli, "@bob:matrix.org");

            room1.getMyMembership = () => KnownMembership.Join;
            room2.getMyMembership = () => KnownMembership.Join;

            const evt = mkMessage({
                room: room1.roomId,
                msg: "Hello world!",
                user: "@alice:matrix.org",
                ts: 5,
                event: true,
            });

            room1.addLiveEvents([evt], { addToState: true });

            expect(algorithm.sortRooms([room2, room1], DefaultTagID.Untagged)).toEqual([room2, room1]);

            const { events } = mkThread({
                room: room1,
                client: cli,
                authorId: "@bob:matrix.org",
                participantUserIds: ["@bob:matrix.org"],
                ts: 12,
            });

            room1.addLiveEvents(events, { addToState: true });
        });

        it("orders rooms based on thread replies too", () => {
            const room1 = new Room("room1", cli, "@bob:matrix.org");
            const room2 = new Room("room2", cli, "@bob:matrix.org");

            room1.getMyMembership = () => KnownMembership.Join;
            room2.getMyMembership = () => KnownMembership.Join;

            const { rootEvent, events: events1 } = mkThread({
                room: room1,
                client: cli,
                authorId: "@bob:matrix.org",
                participantUserIds: ["@bob:matrix.org"],
                ts: 12,
                length: 5,
            });
            room1.addLiveEvents(events1, { addToState: true });

            const { events: events2 } = mkThread({
                room: room2,
                client: cli,
                authorId: "@bob:matrix.org",
                participantUserIds: ["@bob:matrix.org"],
                ts: 14,
                length: 10,
            });
            room2.addLiveEvents(events2, { addToState: true });

            expect(algorithm.sortRooms([room1, room2], DefaultTagID.Untagged)).toEqual([room2, room1]);

            const threadReply = makeThreadEvent({
                user: "@bob:matrix.org",
                room: room1.roomId,
                event: true,
                msg: `hello world`,
                rootEventId: rootEvent.getId()!,
                replyToEventId: rootEvent.getId()!,
                // replies are 1ms after each other
                ts: 50,
            });
            room1.addLiveEvents([threadReply], { addToState: true });

            expect(algorithm.sortRooms([room1, room2], DefaultTagID.Untagged)).toEqual([room1, room2]);
        });
    });
});
