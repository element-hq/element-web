/*
Copyright 2018 New Vector Ltd
Copyright 2019, 2022 The Matrix.org Foundation C.I.C.

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
import { Room, RoomMember, EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { PermalinkParts } from "../../../src/utils/permalinks/PermalinkConstructor";
import {
    makeRoomPermalink,
    makeUserPermalink,
    parsePermalink,
    RoomPermalinkCreator,
} from "../../../src/utils/permalinks/Permalinks";
import { getMockClientWithEventEmitter } from "../../test-utils";

describe("Permalinks", function () {
    const userId = "@test:example.com";
    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(userId),
        getRoom: jest.fn(),
    });
    mockClient.credentials = { userId };

    const makeMemberWithPL = (roomId: Room["roomId"], userId: string, powerLevel: number): RoomMember => {
        const member = new RoomMember(roomId, userId);
        member.powerLevel = powerLevel;
        return member;
    };

    function mockRoom(
        roomId: Room["roomId"],
        members: RoomMember[],
        serverACLContent?: { deny?: string[]; allow?: string[] },
    ): Room {
        members.forEach((m) => (m.membership = "join"));
        const powerLevelsUsers = members.reduce<Record<string, number>>((pl, member) => {
            if (Number.isFinite(member.powerLevel)) {
                pl[member.userId] = member.powerLevel;
            }
            return pl;
        }, {});

        const room = new Room(roomId, mockClient, userId);

        const powerLevels = new MatrixEvent({
            type: EventType.RoomPowerLevels,
            room_id: roomId,
            state_key: "",
            content: {
                users: powerLevelsUsers,
                users_default: 0,
            },
        });
        const serverACL = serverACLContent
            ? new MatrixEvent({
                  type: EventType.RoomServerAcl,
                  room_id: roomId,
                  state_key: "",
                  content: serverACLContent,
              })
            : undefined;
        const stateEvents = serverACL ? [powerLevels, serverACL] : [powerLevels];
        room.currentState.setStateEvents(stateEvents);

        jest.spyOn(room, "getCanonicalAlias").mockReturnValue(null);
        jest.spyOn(room, "getJoinedMembers").mockReturnValue(members);
        jest.spyOn(room, "getMember").mockImplementation((userId) => members.find((m) => m.userId === userId) || null);

        return room;
    }
    beforeEach(function () {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.spyOn(MatrixClientPeg, "get").mockRestore();
    });

    it("should pick no candidate servers when the room has no members", function () {
        const room = mockRoom("!fake:example.org", []);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(0);
    });

    it("should gracefully handle invalid MXIDs", () => {
        const roomId = "!fake:example.org";
        const alice50 = makeMemberWithPL(roomId, "@alice:pl_50:org", 50);
        const room = mockRoom(roomId, [alice50]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
    });

    it("should pick a candidate server for the highest power level user in the room", function () {
        const roomId = "!fake:example.org";
        const alice50 = makeMemberWithPL(roomId, "@alice:pl_50", 50);
        const alice75 = makeMemberWithPL(roomId, "@alice:pl_75", 75);
        const alice95 = makeMemberWithPL(roomId, "@alice:pl_95", 95);
        const room = mockRoom("!fake:example.org", [alice50, alice75, alice95]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(3);
        expect(creator.serverCandidates![0]).toBe("pl_95");
        // we don't check the 2nd and 3rd servers because that is done by the next test
    });

    it("should change candidate server when highest power level user leaves the room", function () {
        const roomId = "!fake:example.org";
        const member95 = makeMemberWithPL(roomId, "@alice:pl_95", 95);

        const room = mockRoom(roomId, [
            makeMemberWithPL(roomId, "@alice:pl_50", 50),
            makeMemberWithPL(roomId, "@alice:pl_75", 75),
            member95,
        ]);
        const creator = new RoomPermalinkCreator(room, null);
        creator.load();
        expect(creator.serverCandidates![0]).toBe("pl_95");
        member95.membership = "left";
        // @ts-ignore illegal private property
        creator.onRoomStateUpdate();
        expect(creator.serverCandidates![0]).toBe("pl_75");
        member95.membership = "join";
        // @ts-ignore illegal private property
        creator.onRoomStateUpdate();
        expect(creator.serverCandidates![0]).toBe("pl_95");
    });

    it("should pick candidate servers based on user population", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(roomId, [
            makeMemberWithPL(roomId, "@alice:first", 0),
            makeMemberWithPL(roomId, "@bob:first", 0),
            makeMemberWithPL(roomId, "@charlie:first", 0),
            makeMemberWithPL(roomId, "@alice:second", 0),
            makeMemberWithPL(roomId, "@bob:second", 0),
            makeMemberWithPL(roomId, "@charlie:third", 0),
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(3);
        expect(creator.serverCandidates![0]).toBe("first");
        expect(creator.serverCandidates![1]).toBe("second");
        expect(creator.serverCandidates![2]).toBe("third");
    });

    it("should pick prefer candidate servers with higher power levels", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(roomId, [
            makeMemberWithPL(roomId, "@alice:first", 100),
            makeMemberWithPL(roomId, "@alice:second", 0),
            makeMemberWithPL(roomId, "@bob:second", 0),
            makeMemberWithPL(roomId, "@charlie:third", 0),
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates!.length).toBe(3);
        expect(creator.serverCandidates![0]).toBe("first");
        expect(creator.serverCandidates![1]).toBe("second");
        expect(creator.serverCandidates![2]).toBe("third");
    });

    it("should pick a maximum of 3 candidate servers", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(roomId, [
            makeMemberWithPL(roomId, "@alice:alpha", 100),
            makeMemberWithPL(roomId, "@alice:bravo", 0),
            makeMemberWithPL(roomId, "@alice:charlie", 0),
            makeMemberWithPL(roomId, "@alice:delta", 0),
            makeMemberWithPL(roomId, "@alice:echo", 0),
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(3);
    });

    it("should not consider IPv4 hosts", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(roomId, [makeMemberWithPL(roomId, "@alice:127.0.0.1", 100)]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(0);
    });

    it("should not consider IPv6 hosts", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(roomId, [makeMemberWithPL(roomId, "@alice:[::1]", 100)]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(0);
    });

    it("should not consider IPv4 hostnames with ports", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(roomId, [makeMemberWithPL(roomId, "@alice:127.0.0.1:8448", 100)]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(0);
    });

    it("should not consider IPv6 hostnames with ports", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(roomId, [makeMemberWithPL(roomId, "@alice:[::1]:8448", 100)]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(0);
    });

    it("should work with hostnames with ports", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(roomId, [makeMemberWithPL(roomId, "@alice:example.org:8448", 100)]);

        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(1);
        expect(creator.serverCandidates![0]).toBe("example.org:8448");
    });

    it("should not consider servers explicitly denied by ACLs", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(
            roomId,
            [
                makeMemberWithPL(roomId, "@alice:evilcorp.com", 100),
                makeMemberWithPL(roomId, "@bob:chat.evilcorp.com", 0),
            ],
            {
                deny: ["evilcorp.com", "*.evilcorp.com"],
                allow: ["*"],
            },
        );
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(0);
    });

    it("should not consider servers not allowed by ACLs", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(
            roomId,
            [
                makeMemberWithPL(roomId, "@alice:evilcorp.com", 100),
                makeMemberWithPL(roomId, "@bob:chat.evilcorp.com", 0),
            ],
            {
                deny: [],
                allow: [], // implies "ban everyone"
            },
        );
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(0);
    });

    it("should consider servers not explicitly banned by ACLs", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(
            roomId,
            [
                makeMemberWithPL(roomId, "@alice:evilcorp.com", 100),
                makeMemberWithPL(roomId, "@bob:chat.evilcorp.com", 0),
            ],
            {
                deny: ["*.evilcorp.com"], // evilcorp.com is still good though
                allow: ["*"],
            },
        );
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(1);
        expect(creator.serverCandidates![0]).toEqual("evilcorp.com");
    });

    it("should consider servers not disallowed by ACLs", function () {
        const roomId = "!fake:example.org";
        const room = mockRoom(
            "!fake:example.org",
            [
                makeMemberWithPL(roomId, "@alice:evilcorp.com", 100),
                makeMemberWithPL(roomId, "@bob:chat.evilcorp.com", 0),
            ],
            {
                deny: [],
                allow: ["evilcorp.com"], // implies "ban everyone else"
            },
        );
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator.serverCandidates).toBeTruthy();
        expect(creator.serverCandidates!.length).toBe(1);
        expect(creator.serverCandidates![0]).toEqual("evilcorp.com");
    });

    it("should generate an event permalink for room IDs with no candidate servers", function () {
        const room = mockRoom("!somewhere:example.org", []);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        const result = creator.forEvent("$something:example.com");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org/$something:example.com");
    });

    it("should generate an event permalink for room IDs with some candidate servers", function () {
        const roomId = "!somewhere:example.org";
        const room = mockRoom(roomId, [
            makeMemberWithPL(roomId, "@alice:first", 100),
            makeMemberWithPL(roomId, "@bob:second", 0),
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        const result = creator.forEvent("$something:example.com");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org/$something:example.com?via=first&via=second");
    });

    it("should generate a room permalink for room IDs with some candidate servers", function () {
        mockClient.getRoom.mockImplementation((roomId: Room["roomId"]) => {
            return mockRoom(roomId, [
                makeMemberWithPL(roomId, "@alice:first", 100),
                makeMemberWithPL(roomId, "@bob:second", 0),
            ]);
        });
        const result = makeRoomPermalink(mockClient, "!somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org?via=first&via=second");
    });

    it("should generate a room permalink for room aliases with no candidate servers", function () {
        mockClient.getRoom.mockReturnValue(null);
        const result = makeRoomPermalink(mockClient, "#somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/#somewhere:example.org");
    });

    it("should generate a room permalink for room aliases without candidate servers", function () {
        mockClient.getRoom.mockImplementation((roomId: Room["roomId"]) => {
            return mockRoom(roomId, [
                makeMemberWithPL(roomId, "@alice:first", 100),
                makeMemberWithPL(roomId, "@bob:second", 0),
            ]);
        });
        const result = makeRoomPermalink(mockClient, "#somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/#somewhere:example.org");
    });

    it("should generate a user permalink", function () {
        const result = makeUserPermalink("@someone:example.org");
        expect(result).toBe("https://matrix.to/#/@someone:example.org");
    });

    describe("parsePermalink", () => {
        it("should correctly parse room permalinks with a via argument", () => {
            const result = parsePermalink("https://matrix.to/#/!room_id:server?via=some.org");
            expect(result?.roomIdOrAlias).toBe("!room_id:server");
            expect(result?.viaServers).toEqual(["some.org"]);
        });

        it("should correctly parse room permalink via arguments", () => {
            const result = parsePermalink("https://matrix.to/#/!room_id:server?via=foo.bar&via=bar.foo");
            expect(result?.roomIdOrAlias).toBe("!room_id:server");
            expect(result?.viaServers).toEqual(["foo.bar", "bar.foo"]);
        });

        it("should correctly parse event permalink via arguments", () => {
            const result = parsePermalink(
                "https://matrix.to/#/!room_id:server/$event_id/some_thing_here/foobar" + "?via=m1.org&via=m2.org",
            );
            expect(result?.eventId).toBe("$event_id/some_thing_here/foobar");
            expect(result?.roomIdOrAlias).toBe("!room_id:server");
            expect(result?.viaServers).toEqual(["m1.org", "m2.org"]);
        });

        it("should correctly parse permalinks with http protocol", () => {
            expect(parsePermalink("http://matrix.to/#/@user:example.com")).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });

        it("should correctly parse permalinks without protocol", () => {
            expect(parsePermalink("matrix.to/#/@user:example.com")).toEqual(
                new PermalinkParts(null, null, "@user:example.com", null),
            );
        });
    });
});
