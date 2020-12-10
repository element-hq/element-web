/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import {MatrixClientPeg as peg} from '../../../src/MatrixClientPeg';
import {
    makeGroupPermalink,
    makeRoomPermalink,
    makeUserPermalink,
    parsePermalink,
    RoomPermalinkCreator,
} from "../../../src/utils/permalinks/Permalinks";
import * as testUtils from "../../test-utils";

function mockRoom(roomId, members, serverACL) {
    members.forEach(m => m.membership = "join");
    const powerLevelsUsers = members.reduce((pl, member) => {
        if (Number.isFinite(member.powerLevel)) {
            pl[member.userId] = member.powerLevel;
        }
        return pl;
    }, {});

    return {
        roomId,
        getCanonicalAlias: () => roomId,
        getJoinedMembers: () => members,
        getMember: (userId) => members.find(m => m.userId === userId),
        currentState: {
            getStateEvents: (type, key) => {
                if (key) {
                    return null;
                }
                let content;
                switch (type) {
                    case "m.room.server_acl":
                        content = serverACL;
                        break;
                    case "m.room.power_levels":
                        content = {users: powerLevelsUsers, users_default: 0};
                        break;
                }
                if (content) {
                    return {
                        getContent: () => content,
                    };
                } else {
                    return null;
                }
            },
        },
        on: () => undefined,
        removeListener: () => undefined,
    };
}

describe('Permalinks', function() {
    beforeEach(function() {
        testUtils.stubClient();
        peg.get().credentials = { userId: "@test:example.com" };
    });

    it('should pick no candidate servers when the room has no members', function() {
        const room = mockRoom("!fake:example.org", []);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(0);
    });

    it('should pick a candidate server for the highest power level user in the room', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:pl_50",
                powerLevel: 50,
            },
            {
                userId: "@alice:pl_75",
                powerLevel: 75,
            },
            {
                userId: "@alice:pl_95",
                powerLevel: 95,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(3);
        expect(creator._serverCandidates[0]).toBe("pl_95");
        // we don't check the 2nd and 3rd servers because that is done by the next test
    });

    it('should change candidate server when highest power level user leaves the room', function() {
        const member95 = {
            userId: "@alice:pl_95",
            powerLevel: 95,
        };
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:pl_50",
                powerLevel: 50,
            },
            {
                userId: "@alice:pl_75",
                powerLevel: 75,
            },
            member95,
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates[0]).toBe("pl_95");
        member95.membership = "left";
        creator.onMembership({}, member95, "join");
        expect(creator._serverCandidates[0]).toBe("pl_75");
        member95.membership = "join";
        creator.onMembership({}, member95, "left");
        expect(creator._serverCandidates[0]).toBe("pl_95");
    });

    it('should pick candidate servers based on user population', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:first",
                powerLevel: 0,
            },
            {
                userId: "@bob:first",
                powerLevel: 0,
            },
            {
                userId: "@charlie:first",
                powerLevel: 0,
            },
            {
                userId: "@alice:second",
                powerLevel: 0,
            },
            {
                userId: "@bob:second",
                powerLevel: 0,
            },
            {
                userId: "@charlie:third",
                powerLevel: 0,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(3);
        expect(creator._serverCandidates[0]).toBe("first");
        expect(creator._serverCandidates[1]).toBe("second");
        expect(creator._serverCandidates[2]).toBe("third");
    });

    it('should pick prefer candidate servers with higher power levels', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:first",
                powerLevel: 100,
            },
            {
                userId: "@alice:second",
                powerLevel: 0,
            },
            {
                userId: "@bob:second",
                powerLevel: 0,
            },
            {
                userId: "@charlie:third",
                powerLevel: 0,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates.length).toBe(3);
        expect(creator._serverCandidates[0]).toBe("first");
        expect(creator._serverCandidates[1]).toBe("second");
        expect(creator._serverCandidates[2]).toBe("third");
    });

    it('should pick a maximum of 3 candidate servers', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:alpha",
                powerLevel: 100,
            },
            {
                userId: "@alice:bravo",
                powerLevel: 0,
            },
            {
                userId: "@alice:charlie",
                powerLevel: 0,
            },
            {
                userId: "@alice:delta",
                powerLevel: 0,
            },
            {
                userId: "@alice:echo",
                powerLevel: 0,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(3);
    });

    it('should not consider IPv4 hosts', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:127.0.0.1",
                powerLevel: 100,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(0);
    });

    it('should not consider IPv6 hosts', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:[::1]",
                powerLevel: 100,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(0);
    });

    it('should not consider IPv4 hostnames with ports', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:127.0.0.1:8448",
                powerLevel: 100,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(0);
    });

    it('should not consider IPv6 hostnames with ports', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:[::1]:8448",
                powerLevel: 100,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(0);
    });

    it('should work with hostnames with ports', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:example.org:8448",
                powerLevel: 100,
            },
        ]);

        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(1);
        expect(creator._serverCandidates[0]).toBe("example.org:8448");
    });

    it('should not consider servers explicitly denied by ACLs', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:evilcorp.com",
                powerLevel: 100,
            },
            {
                userId: "@bob:chat.evilcorp.com",
                powerLevel: 0,
            },
        ], {
            deny: ["evilcorp.com", "*.evilcorp.com"],
            allow: ["*"],
        });
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(0);
    });

    it('should not consider servers not allowed by ACLs', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:evilcorp.com",
                powerLevel: 100,
            },
            {
                userId: "@bob:chat.evilcorp.com",
                powerLevel: 0,
            },
        ], {
            deny: [],
            allow: [], // implies "ban everyone"
        });
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(0);
    });

    it('should consider servers not explicitly banned by ACLs', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:evilcorp.com",
                powerLevel: 100,
            },
            {
                userId: "@bob:chat.evilcorp.com",
                powerLevel: 0,
            },
        ], {
            deny: ["*.evilcorp.com"], // evilcorp.com is still good though
            allow: ["*"],
        });
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(1);
        expect(creator._serverCandidates[0]).toEqual("evilcorp.com");
    });

    it('should consider servers not disallowed by ACLs', function() {
        const room = mockRoom("!fake:example.org", [
            {
                userId: "@alice:evilcorp.com",
                powerLevel: 100,
            },
            {
                userId: "@bob:chat.evilcorp.com",
                powerLevel: 0,
            },
        ], {
            deny: [],
            allow: ["evilcorp.com"], // implies "ban everyone else"
        });
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        expect(creator._serverCandidates).toBeTruthy();
        expect(creator._serverCandidates.length).toBe(1);
        expect(creator._serverCandidates[0]).toEqual("evilcorp.com");
    });

    it('should generate an event permalink for room IDs with no candidate servers', function() {
        const room = mockRoom("!somewhere:example.org", []);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        const result = creator.forEvent("$something:example.com");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org/$something:example.com");
    });

    it('should generate an event permalink for room IDs with some candidate servers', function() {
        const room = mockRoom("!somewhere:example.org", [
            {
                userId: "@alice:first",
                powerLevel: 100,
            },
            {
                userId: "@bob:second",
                powerLevel: 0,
            },
        ]);
        const creator = new RoomPermalinkCreator(room);
        creator.load();
        const result = creator.forEvent("$something:example.com");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org/$something:example.com?via=first&via=second");
    });

    it('should generate a room permalink for room IDs with some candidate servers', function() {
        peg.get().getRoom = (roomId) => {
            return mockRoom(roomId, [
                {
                    userId: "@alice:first",
                    powerLevel: 100,
                },
                {
                    userId: "@bob:second",
                    powerLevel: 0,
                },
            ]);
        };
        const result = makeRoomPermalink("!somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org?via=first&via=second");
    });

    it('should generate a room permalink for room aliases with no candidate servers', function() {
        peg.get().getRoom = () => null;
        const result = makeRoomPermalink("#somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/#somewhere:example.org");
    });

    it('should generate a room permalink for room aliases without candidate servers', function() {
        peg.get().getRoom = (roomId) => {
            return mockRoom(roomId, [
                {
                    userId: "@alice:first",
                    powerLevel: 100,
                },
                {
                    userId: "@bob:second",
                    powerLevel: 0,
                },
            ]);
        };
        const result = makeRoomPermalink("#somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/#somewhere:example.org");
    });

    it('should generate a user permalink', function() {
        const result = makeUserPermalink("@someone:example.org");
        expect(result).toBe("https://matrix.to/#/@someone:example.org");
    });

    it('should generate a group permalink', function() {
        const result = makeGroupPermalink("+community:example.org");
        expect(result).toBe("https://matrix.to/#/+community:example.org");
    });

    it('should correctly parse room permalinks with a via argument', () => {
        const result = parsePermalink("https://matrix.to/#/!room_id:server?via=some.org");
        expect(result.roomIdOrAlias).toBe("!room_id:server");
        expect(result.viaServers).toEqual(["some.org"]);
    });

    it('should correctly parse room permalink via arguments', () => {
        const result = parsePermalink("https://matrix.to/#/!room_id:server?via=foo.bar&via=bar.foo");
        expect(result.roomIdOrAlias).toBe("!room_id:server");
        expect(result.viaServers).toEqual(["foo.bar", "bar.foo"]);
    });

    it('should correctly parse event permalink via arguments', () => {
        const result = parsePermalink("https://matrix.to/#/!room_id:server/$event_id/some_thing_here/foobar" +
            "?via=m1.org&via=m2.org");
        expect(result.eventId).toBe("$event_id/some_thing_here/foobar");
        expect(result.roomIdOrAlias).toBe("!room_id:server");
        expect(result.viaServers).toEqual(["m1.org", "m2.org"]);
    });
});
