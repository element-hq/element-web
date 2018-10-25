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
import {pickServerCandidates} from "../src/matrix-to";


describe('matrix-to', function () {
    it('should pick no candidate servers when the room is not found', function () {
        //peg.getRoom = () => null;
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(0);
    });
    it('should pick no candidate servers when the room has no members', function () {
        peg.getRoom = () => {
            return {
                getJoinedMembers: () => [],
            }
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(0);
    });
    it('should pick no candidate servers when no users have enough power level', function () {
        peg.getRoom = () => {
            return {
                getJoinedMembers: () => [
                    {
                        userId: "@alice:example.org",
                        powerLevel: 0,
                    },
                    {
                        userId: "@bob:example.org",
                        powerLevel: 25,
                    }
                ],
            }
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(0);
    });
    it('should pick a candidate server for the highest power level user in the room', function () {
        peg.getRoom = () => {
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
                    }
                ],
            }
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(3);
        expect(pickedServers[0]).toBe("pl_95");
        // we don't check the 2nd and 3rd servers because that is done by the next test
    });
    it('should pick candidate servers based on user population', function () {
        peg.getRoom = () => {
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
                    }
                ],
            }
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(3);
        expect(pickedServers[0]).toBe("first");
        expect(pickedServers[1]).toBe("second");
        expect(pickedServers[2]).toBe("third");
    });
    it('should pick prefer candidate servers with higher power levels', function () {
        peg.getRoom = () => {
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
                    }
                ],
            }
        };
        const pickedServers = pickServerCandidates("!somewhere:example.org");
        expect(pickedServers).toExist();
        expect(pickedServers.length).toBe(3);
        expect(pickedServers[0]).toBe("first");
        expect(pickedServers[1]).toBe("second");
        expect(pickedServers[2]).toBe("third");
    });
});
