/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, afterEach, vi } from "vitest";
import { mkRoom, mkRoomMember, stubClient } from "test-utils";
import { waitFor } from "test-utils-rtl";

import UserProvider from "./UserProvider";
import { makeUserPermalink } from "../utils/permalinks/Permalinks";
import SettingsStore from "../settings/SettingsStore";

describe("UserProvider", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

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
                getUserStatus: expect.any(Function),
            },
        ]);
    });

    describe("getUserStatus", () => {
        const setUpRoomWithAlice = () => {
            const client = vi.mocked(stubClient());
            const room = mkRoom(client, "!room:e.com");
            const alice = mkRoomMember(room.roomId, "@alice:e.com");
            room.getJoinedMembers.mockReturnValue([alice]);

            client.doesServerSupportExtendedProfiles.mockResolvedValue(true);
            client.getExtendedProfileProperty.mockResolvedValue({ emoji: "💡", text: "Having an idea" });

            return { room, client };
        };

        it("returns the user's status once it has been fetched", async () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((name): any => name === "feature_user_status");
            const { room } = setUpRoomWithAlice();

            const userProvider = new UserProvider(room);
            const completions = await userProvider.getCompletions("@ali", { beginning: true, start: 0, end: 4 });

            // The status is fetched asynchronously, so it is read lazily rather than captured when
            // the completion was built.
            await waitFor(() =>
                expect(completions[0].getUserStatus!()).toEqual({ emoji: "💡", text: "Having an idea" }),
            );
        });

        it("returns undefined when the feature is disabled", async () => {
            vi.spyOn(SettingsStore, "getValue").mockImplementation((): any => false);
            const { room, client } = setUpRoomWithAlice();

            const userProvider = new UserProvider(room);
            const completions = await userProvider.getCompletions("@ali", { beginning: true, start: 0, end: 4 });

            // Assert the status was never fetched, so that this can't pass merely because the
            // request had not resolved yet.
            await waitFor(() => expect(client.doesServerSupportExtendedProfiles).not.toHaveBeenCalled());
            expect(completions[0].getUserStatus!()).toBeUndefined();
        });
    });
});
