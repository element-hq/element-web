/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, PendingEventOrdering, Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import Modal, { type ComponentType, type IHandle } from "../../../src/Modal";
import { setUpCommandTest } from "./utils";
import { type Command } from "../../../src/slash-commands/command";

describe("/part", () => {
    const roomId = "!room:example.com";

    function setUp(): {
        client: MatrixClient;
        command: Command;
        args?: string;
        room1: Room;
        room2: Room;
    } {
        const spy = jest.spyOn(Modal, "createDialog");
        spy.mockReturnValue({ close: () => {} } as unknown as IHandle<ComponentType>);

        const { client, command, args } = setUpCommandTest(roomId, "/part #foo:bar");
        expect(args).toBeDefined();

        const room1 = new Room("!room-id", client, client.getSafeUserId(), {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });

        const room2 = new Room("!other-room", client, client.getSafeUserId());

        mocked(client.getRoom).mockImplementation((rId: string): Room | null => {
            if (rId === room1.roomId) {
                return room1;
            } else if (rId === room2.roomId) {
                return room2;
            } else {
                return null;
            }
        });
        mocked(client.getRooms).mockReturnValue([room1, room2]);

        return { client, command, args, room1, room2 };
    }

    it("should part room matching alias if found", async () => {
        const { client, command, args, room1, room2 } = setUp();
        room1.getCanonicalAlias = jest.fn().mockReturnValue("#foo:bar");
        room2.getCanonicalAlias = jest.fn().mockReturnValue("#baz:bar");

        await command.run(client, room1.roomId, null, args).promise;

        expect(client.leaveRoomChain).toHaveBeenCalledWith(room1.roomId, expect.anything());
    });

    it("should part room matching alt alias if found", async () => {
        const { client, command, args, room1, room2 } = setUp();
        room1.getAltAliases = jest.fn().mockReturnValue(["#foo:bar"]);
        room2.getAltAliases = jest.fn().mockReturnValue(["#baz:bar"]);

        await command.run(client, room1.roomId, null, args).promise;

        expect(client.leaveRoomChain).toHaveBeenCalledWith(room1.roomId, expect.anything());
    });
});
