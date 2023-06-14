/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { filterValidMDirect } from "../../../src/utils/dm/filterValidMDirect";

const roomId1 = "!room1:example.com";
const roomId2 = "!room2:example.com";
const userId1 = "@user1:example.com";
const userId2 = "@user2:example.com";
const userId3 = "@user3:example.com";

describe("filterValidMDirect", () => {
    it("should return an empty object as valid content", () => {
        expect(filterValidMDirect({})).toEqual({
            valid: true,
            filteredContent: {},
        });
    });

    it("should return valid content", () => {
        expect(
            filterValidMDirect({
                [userId1]: [roomId1, roomId2],
                [userId2]: [roomId1],
            }),
        ).toEqual({
            valid: true,
            filteredContent: {
                [userId1]: [roomId1, roomId2],
                [userId2]: [roomId1],
            },
        });
    });

    it("should return an empy object for null", () => {
        expect(filterValidMDirect(null)).toEqual({
            valid: false,
            filteredContent: {},
        });
    });

    it("should return an empy object for a non-object", () => {
        expect(filterValidMDirect(23)).toEqual({
            valid: false,
            filteredContent: {},
        });
    });

    it("should only return valid content", () => {
        const invalidContent = {
            [userId1]: [23],
            [userId2]: [roomId2],
            [userId3]: "room1",
        };

        expect(filterValidMDirect(invalidContent)).toEqual({
            valid: false,
            filteredContent: {
                [userId1]: [],
                [userId2]: [roomId2],
            },
        });
    });
});
