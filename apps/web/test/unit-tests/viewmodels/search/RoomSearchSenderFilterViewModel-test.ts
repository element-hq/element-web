/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { mocked } from "jest-mock";
import { Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import { RoomSearchSenderFilterViewModel } from "../../../../src/viewmodels/search/RoomSearchSenderFilterViewModel";
import { stubClient } from "../../../test-utils";

const member = (userId: string, name: string): RoomMember => ({ userId, name }) as RoomMember;

describe("RoomSearchSenderFilterViewModel", () => {
    const myUserId = "@me:server";

    const buildRoom = (members: RoomMember[]): Room => {
        const client = mocked(stubClient());
        const room = new Room("!r:server", client, myUserId);
        jest.spyOn(room, "getJoinedMembers").mockReturnValue(members);
        return room;
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("lists joined members excluding the current user, sorted by display name", () => {
        const room = buildRoom([
            member("@me:server", "Me"),
            member("@bob:server", "Bob"),
            member("@alice:server", "Alice"),
        ]);

        const vm = new RoomSearchSenderFilterViewModel({ room });

        expect(vm.getSnapshot().members).toEqual([
            { userId: "@alice:server", name: "Alice" },
            { userId: "@bob:server", name: "Bob" },
        ]);
    });

    it("exposes an empty member list when the room only contains the current user", () => {
        const room = buildRoom([member("@me:server", "Me")]);

        const vm = new RoomSearchSenderFilterViewModel({ room });

        expect(vm.getSnapshot().members).toEqual([]);
    });
});
