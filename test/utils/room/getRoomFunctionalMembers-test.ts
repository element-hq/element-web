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

import { Room, UNSTABLE_ELEMENT_FUNCTIONAL_USERS } from "matrix-js-sdk/src/matrix";

import { getFunctionalMembers } from "../../../src/utils/room/getFunctionalMembers";
import { createTestClient, mkEvent } from "../../test-utils";

describe("getRoomFunctionalMembers", () => {
    const client = createTestClient();
    const room = new Room("!room:example.com", client, client.getUserId()!);

    it("should return an empty array if no functional members state event exists", () => {
        expect(getFunctionalMembers(room)).toHaveLength(0);
    });

    it("should return an empty array if functional members state event does not have a service_members field", () => {
        room.currentState.setStateEvents([
            mkEvent({
                event: true,
                type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                user: "@user:example.com)",
                room: room.roomId,
                skey: "",
                content: {},
            }),
        ]);
        expect(getFunctionalMembers(room)).toHaveLength(0);
    });

    it("should return service_members field of the functional users state event", () => {
        room.currentState.setStateEvents([
            mkEvent({
                event: true,
                type: UNSTABLE_ELEMENT_FUNCTIONAL_USERS.name,
                user: "@user:example.com)",
                room: room.roomId,
                skey: "",
                content: { service_members: ["@user:example.com"] },
            }),
        ]);
        expect(getFunctionalMembers(room)).toEqual(["@user:example.com"]);
    });
});
