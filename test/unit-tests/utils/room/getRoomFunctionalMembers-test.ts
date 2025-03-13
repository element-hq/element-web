/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Room, UNSTABLE_ELEMENT_FUNCTIONAL_USERS } from "matrix-js-sdk/src/matrix";

import { getFunctionalMembers } from "../../../../src/utils/room/getFunctionalMembers";
import { createTestClient, mkEvent } from "../../../test-utils";

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
