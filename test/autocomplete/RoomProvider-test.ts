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

import { mocked } from "jest-mock";
import { MatrixClient, Room } from "matrix-js-sdk/src/matrix";

import RoomProvider from "../../src/autocomplete/RoomProvider";
import SettingsStore from "../../src/settings/SettingsStore";
import { mkRoom, mkSpace, stubClient } from "../test-utils";

describe("RoomProvider", () => {
    it("suggests a room whose alias matches a prefix", async () => {
        // Given a room
        const client = stubClient();
        const room = makeRoom(client, "room:e.com");
        mocked(client.getVisibleRooms).mockReturnValue([room]);

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
        mocked(client.getVisibleRooms).mockReturnValue([room1, room2, other, space]);

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
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            const client = stubClient();
            const room = makeRoom(client, "room:e.com");
            mocked(client.getVisibleRooms).mockReturnValue([room]);
            mocked(client.getVisibleRooms).mockClear();

            const roomProvider = new RoomProvider(room);
            await roomProvider.getCompletions("#ro", { beginning: true, start: 0, end: 3 });

            expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            const client = stubClient();
            const room = makeRoom(client, "room:e.com");
            mocked(client.getVisibleRooms).mockReturnValue([room]);
            mocked(client.getVisibleRooms).mockClear();

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
