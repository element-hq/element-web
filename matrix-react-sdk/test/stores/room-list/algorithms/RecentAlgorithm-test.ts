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

import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient } from "matrix-js-sdk/src/matrix";

import { mkMessage, mkRoom, stubClient } from "../../../test-utils";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";
import "../../../../src/stores/room-list/RoomListStore";
import { RecentAlgorithm } from "../../../../src/stores/room-list/algorithms/tag-sorting/RecentAlgorithm";
import { EffectiveMembership } from "../../../../src/utils/membership";
import { makeThreadEvent, mkThread } from "../../../test-utils/threads";
import { DefaultTagID } from "../../../../src/stores/room-list/models";

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

            room.getMyMembership = () => "join";

            room.addLiveEvents([event1]);
            expect(algorithm.getLastTs(room, "@jane:matrix.org")).toBe(5);
            expect(algorithm.getLastTs(room, "@john:matrix.org")).toBe(5);

            room.addLiveEvents([event2]);

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
            room.getMyMembership.mockReturnValue(EffectiveMembership.Invite);
            expect(algorithm.getLastTs(room, "@john:matrix.org")).toBe(Number.MAX_SAFE_INTEGER);
        });
    });

    describe("sortRooms", () => {
        it("orders rooms per last message ts", () => {
            const room1 = new Room("room1", cli, "@bob:matrix.org");
            const room2 = new Room("room2", cli, "@bob:matrix.org");

            room1.getMyMembership = () => "join";
            room2.getMyMembership = () => "join";

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

            room1.addLiveEvents([evt]);
            room2.addLiveEvents([evt2]);

            expect(algorithm.sortRooms([room2, room1], DefaultTagID.Untagged)).toEqual([room1, room2]);
        });

        it("orders rooms without messages first", () => {
            const room1 = new Room("room1", cli, "@bob:matrix.org");
            const room2 = new Room("room2", cli, "@bob:matrix.org");

            room1.getMyMembership = () => "join";
            room2.getMyMembership = () => "join";

            const evt = mkMessage({
                room: room1.roomId,
                msg: "Hello world!",
                user: "@alice:matrix.org",
                ts: 5,
                event: true,
            });

            room1.addLiveEvents([evt]);

            expect(algorithm.sortRooms([room2, room1], DefaultTagID.Untagged)).toEqual([room2, room1]);

            const { events } = mkThread({
                room: room1,
                client: cli,
                authorId: "@bob:matrix.org",
                participantUserIds: ["@bob:matrix.org"],
                ts: 12,
            });

            room1.addLiveEvents(events);
        });

        it("orders rooms based on thread replies too", () => {
            const room1 = new Room("room1", cli, "@bob:matrix.org");
            const room2 = new Room("room2", cli, "@bob:matrix.org");

            room1.getMyMembership = () => "join";
            room2.getMyMembership = () => "join";

            const { rootEvent, events: events1 } = mkThread({
                room: room1,
                client: cli,
                authorId: "@bob:matrix.org",
                participantUserIds: ["@bob:matrix.org"],
                ts: 12,
                length: 5,
            });
            room1.addLiveEvents(events1);

            const { events: events2 } = mkThread({
                room: room2,
                client: cli,
                authorId: "@bob:matrix.org",
                participantUserIds: ["@bob:matrix.org"],
                ts: 14,
                length: 10,
            });
            room2.addLiveEvents(events2);

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
            room1.addLiveEvents([threadReply]);

            expect(algorithm.sortRooms([room1, room2], DefaultTagID.Untagged)).toEqual([room1, room2]);
        });
    });
});
