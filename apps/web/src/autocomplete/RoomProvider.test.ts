/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { mkRoom, mkSpace, stubClient } from "test-utils";

import RoomProvider from "./RoomProvider";
import SettingsStore from "../settings/SettingsStore";

describe("RoomProvider", () => {
    it("suggests a room whose alias matches a prefix", async () => {
        // Given a room
        const client = stubClient();
        const room = makeRoom(client, "room:e.com");
        vi.mocked(client.getVisibleRooms).mockReturnValue([room]);

        // When we search for rooms starting with its prefix
        const roomProvider = new RoomProvider(room);
        const completions = await roomProvider.getCompletions("#ro", { beginning: true, start: 0, end: 3 });

        // Then we find it
        expect(completions).toStrictEqual([
            {
                type: "room",
                completion: room.getCanonicalAlias(),
                completionId: room.roomId,
                component: expect.anything(),
                href: "https://matrix.to/#/#room:e.com",
                range: { start: 0, end: 3 },
                suffix: " ",
            },
        ]);
    });

    it("suggests only rooms matching a prefix", async () => {
        // Given some rooms with different names
        const client = stubClient();
        const room1 = makeRoom(client, "room1:e.com");
        const room2 = makeRoom(client, "room2:e.com");
        const other = makeRoom(client, "other:e.com");
        const space = makeSpace(client, "room3:e.com");
        vi.mocked(client.getVisibleRooms).mockReturnValue([room1, room2, other, space]);

        // When we search for rooms starting with a prefix
        const roomProvider = new RoomProvider(room1);
        const completions = await roomProvider.getCompletions("#ro", { beginning: true, start: 0, end: 3 });

        // Then we find the two rooms with that prefix, but not the other one
        expect(completions).toStrictEqual([
            {
                type: "room",
                completion: room1.getCanonicalAlias(),
                completionId: room1.roomId,
                component: expect.anything(),
                href: "https://matrix.to/#/#room1:e.com",
                range: { start: 0, end: 3 },
                suffix: " ",
            },
            {
                type: "room",
                completion: room2.getCanonicalAlias(),
                completionId: room2.roomId,
                component: expect.anything(),
                href: "https://matrix.to/#/#room2:e.com",
                range: { start: 0, end: 3 },
                suffix: " ",
            },
        ]);
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            vi.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            const client = stubClient();
            const room = makeRoom(client, "room:e.com");
            vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
            vi.mocked(client.getVisibleRooms).mockClear();

            const roomProvider = new RoomProvider(room);
            await roomProvider.getCompletions("#ro", { beginning: true, start: 0, end: 3 });

            expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            vi.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            const client = stubClient();
            const room = makeRoom(client, "room:e.com");
            vi.mocked(client.getVisibleRooms).mockReturnValue([room]);
            vi.mocked(client.getVisibleRooms).mockClear();

            const roomProvider = new RoomProvider(room);
            await roomProvider.getCompletions("#ro", { beginning: true, start: 0, end: 3 });

            expect(client.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });
});

function makeSpace(client: MatrixClient, name: string): Room {
    const space = mkSpace(client, `!${name}`);
    space.getCanonicalAlias.mockReturnValue(`#${name}`);
    return space;
}

function makeRoom(client: MatrixClient, name: string): Room {
    const room = mkRoom(client, `!${name}`);
    room.getCanonicalAlias.mockReturnValue(`#${name}`);
    return room;
}
