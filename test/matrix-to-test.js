/*
Copyright 2018 New Vector Ltd
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

import expect from 'expect';
import peg from '../src/MatrixClientPeg';
import {
    makeEventPermalink,
    makeGroupPermalink,
    makeRoomPermalink,
    makeUserPermalink,
    pickServerCandidates
} from "../src/matrix-to";
import * as testUtils from "./test-utils";


describe('matrix-to', function() {
    let sandbox;

    beforeEach(function() {
        testUtils.beforeEach(this);
        sandbox = testUtils.stubClient();
        peg.get().credentials = { userId: "@test:example.com" };
    });

    afterEach(function() {
        sandbox.restore();
    });

    it('should pick no candidate servers when the room is not found', function() {
        peg.get().getRoom = () => null;
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(0);
    });

    it('should pick no candidate servers when the room has no members', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(0);
    });

    it('should pick a candidate server for the highest power level user in the room', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
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
                ],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(3);
        expect(pickedServers[0]).toBe("pl_95");
        // we don't check the 2nd and 3rd servers because that is done by the next test
    });

    it('should pick candidate servers based on user population', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
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
                ],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(3);
        expect(pickedServers[0]).toBe("first");
        expect(pickedServers[1]).toBe("second");
        expect(pickedServers[2]).toBe("third");
    });

    it('should pick prefer candidate servers with higher power levels', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
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
                ],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(3);
        expect(pickedServers[0]).toBe("first");
        expect(pickedServers[1]).toBe("second");
        expect(pickedServers[2]).toBe("third");
    });

    it('should work with IPv4 hostnames', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:127.0.0.1",
                        powerLevel: 100,
                    },
                ],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(1);
        expect(pickedServers[0]).toBe("127.0.0.1");
    });

    it('should work with IPv6 hostnames', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:[::1]",
                        powerLevel: 100,
                    },
                ],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(1);
        expect(pickedServers[0]).toBe("[::1]");
    });

    it('should work with IPv4 hostnames with ports', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:127.0.0.1:8448",
                        powerLevel: 100,
                    },
                ],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(1);
        expect(pickedServers[0]).toBe("127.0.0.1:8448");
    });

    it('should work with IPv6 hostnames with ports', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:[::1]:8448",
                        powerLevel: 100,
                    },
                ],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(1);
        expect(pickedServers[0]).toBe("[::1]:8448");
    });

    it('should work with hostnames with ports', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:example.org:8448",
                        powerLevel: 100,
                    },
                ],
            };
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(1);
        expect(pickedServers[0]).toBe("example.org:8448");
    });

    it('should generate an event permalink for room IDs with no candidate servers', function() {
        peg.get().getRoom = () => null;
        const result = makeEventPermalink("!somewhere:example.org", "$something:example.com");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org/$something:example.com");
    });

    it('should generate an event permalink for room IDs with some candidate servers', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:first",
                        powerLevel: 100,
                    },
                    {
                        userId: "@bob:second",
                        powerLevel: 0,
                    },
                ],
            };
        };
        const result = makeEventPermalink("!somewhere:example.org", "$something:example.com");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org/$something:example.com?via=first&via=second");
    });

    it('should generate a room permalink for room IDs with no candidate servers', function() {
        peg.get().getRoom = () => null;
        const result = makeRoomPermalink("!somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org");
    });

    it('should generate a room permalink for room IDs with some candidate servers', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:first",
                        powerLevel: 100,
                    },
                    {
                        userId: "@bob:second",
                        powerLevel: 0,
                    },
                ],
            };
        };
        const result = makeRoomPermalink("!somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/!somewhere:example.org?via=first&via=second");
    });

    // Technically disallowed but we'll test it anyways
    it('should generate an event permalink for room aliases with no candidate servers', function() {
        peg.get().getRoom = () => null;
        const result = makeEventPermalink("#somewhere:example.org", "$something:example.com");
        expect(result).toBe("https://matrix.to/#/#somewhere:example.org/$something:example.com");
    });

    // Technically disallowed but we'll test it anyways
    it('should generate an event permalink for room aliases without candidate servers even when some are available', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:first",
                        powerLevel: 100,
                    },
                    {
                        userId: "@bob:second",
                        powerLevel: 0,
                    },
                ],
            };
        };
        const result = makeEventPermalink("#somewhere:example.org", "$something:example.com");
        expect(result).toBe("https://matrix.to/#/#somewhere:example.org/$something:example.com");
    });

    it('should generate a room permalink for room aliases with no candidate servers', function() {
        peg.get().getRoom = () => null;
        const result = makeRoomPermalink("#somewhere:example.org");
        expect(result).toBe("https://matrix.to/#/#somewhere:example.org");
    });

    it('should generate a room permalink for room aliases without candidate servers even when some are available', function() {
        peg.get().getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:first",
                        powerLevel: 100,
                    },
                    {
                        userId: "@bob:second",
                        powerLevel: 0,
                    },
                ],
            };
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
});
