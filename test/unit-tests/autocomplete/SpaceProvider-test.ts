/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";

import SpaceProvider from "../../../src/autocomplete/SpaceProvider";
import SettingsStore from "../../../src/settings/SettingsStore";
import { mkRoom, mkSpace, stubClient } from "../../test-utils";

describe("SpaceProvider", () => {
    it("suggests a space whose alias matches a prefix", async () => {
        // Given a space
        const client = stubClient();
        const space = makeSpace(client, "space:e.com");
        mocked(client.getVisibleRooms).mockReturnValue([space]);

        // When we search for spaces starting with its prefix
        const spaceProvider = new SpaceProvider(space);
        const completions = await spaceProvider.getCompletions("#sp", { beginning: true, start: 0, end: 3 });

        // Then we find it
        expect(completions).toStrictEqual([
            {
                type: "room",
                completion: space.getCanonicalAlias(),
                completionId: space.roomId,
                component: expect.anything(),
                href: "https://matrix.to/#/#space:e.com",
                range: { start: 0, end: 3 },
                suffix: " ",
            },
        ]);
    });

    it("suggests only spaces matching a prefix", async () => {
        // Given some spaces with different names
        const client = stubClient();
        const space1 = makeSpace(client, "space1:e.com");
        const space2 = makeSpace(client, "space2:e.com");
        const other = makeSpace(client, "other:e.com");
        const room = makeRoom(client, "space3:e.com");
        mocked(client.getVisibleRooms).mockReturnValue([space1, space2, other, room]);

        // When we search for spaces starting with a prefix
        const spaceProvider = new SpaceProvider(space1);
        const completions = await spaceProvider.getCompletions("#sp", { beginning: true, start: 0, end: 3 });

        // Then we find the two spaces with that prefix, but not the other one
        expect(completions).toStrictEqual([
            {
                type: "room",
                completion: space1.getCanonicalAlias(),
                completionId: space1.roomId,
                component: expect.anything(),
                href: "https://matrix.to/#/#space1:e.com",
                range: { start: 0, end: 3 },
                suffix: " ",
            },
            {
                type: "room",
                completion: space2.getCanonicalAlias(),
                completionId: space2.roomId,
                component: expect.anything(),
                href: "https://matrix.to/#/#space2:e.com",
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
            const space = makeSpace(client, "space:e.com");
            mocked(client.getVisibleRooms).mockReturnValue([space]);
            mocked(client.getVisibleRooms).mockClear();

            const spaceProvider = new SpaceProvider(space);
            await spaceProvider.getCompletions("#ro", { beginning: true, start: 0, end: 3 });

            expect(client.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_space_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            const client = stubClient();
            const space = makeSpace(client, "space:e.com");
            mocked(client.getVisibleRooms).mockReturnValue([space]);
            mocked(client.getVisibleRooms).mockClear();

            const spaceProvider = new SpaceProvider(space);
            await spaceProvider.getCompletions("#ro", { beginning: true, start: 0, end: 3 });

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
