/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import UserProvider from "./UserProvider";
import { makeUserPermalink } from "../utils/permalinks/Permalinks";
import { mkRoom, mkRoomMember, stubClient } from "../../test/test-utils";

describe("UserProvider", () => {
    it("suggests a room member whose id matches the query", async () => {
        const client = stubClient();
        const room = mkRoom(client, "!room:e.com");
        const alice = mkRoomMember(room.roomId, "@alice:e.com");
        room.getJoinedMembers.mockReturnValue([alice]);

        const userProvider = new UserProvider(room);
        const completions = await userProvider.getCompletions("@ali", { beginning: true, start: 0, end: 4 });

        expect(completions).toStrictEqual([
            {
                completion: alice.rawDisplayName,
                completionId: alice.userId,
                type: "user",
                suffix: ": ",
                href: makeUserPermalink(alice.userId),
                component: expect.anything(),
                range: { start: 0, end: 4 },
            },
        ]);
    });
});
