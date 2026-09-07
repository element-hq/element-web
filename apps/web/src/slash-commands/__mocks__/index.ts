/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { vi } from "vitest";
import { stubClient } from "test-utils";

import { type Command } from "../command";
import { getCommand } from "../SlashCommands";
import { SDKContextClass } from "../../contexts/SDKContextClass";
import { LocalRoom } from "../../models/LocalRoom";
import DMRoomMap from "../../utils/DMRoomMap";

export function setUpCommandTest(
    roomId: string,
    input: string,
    roomIsLocal?: boolean,
): {
    command: Command;
    args?: string;
    client: MatrixClient;
    room: Room;
} {
    vi.clearAllMocks();

    // TODO: if getCommand took a MatrixClient argument, we could use
    // createTestClient here instead of stubClient (i.e. avoid setting
    // MatrixClientPeg.)
    const client = stubClient();
    DMRoomMap.makeShared(client);
    const { cmd: command, args } = getCommand(roomId, input);

    let room: Room;

    if (roomIsLocal) {
        room = new LocalRoom(roomId, client, client.getSafeUserId());
    } else {
        room = new Room(roomId, client, client.getSafeUserId());
    }

    vi.spyOn(SDKContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(roomId);

    vi.mocked(client.getRoom).mockImplementation((rId: string | undefined): Room | null => {
        if (rId === roomId) {
            return room;
        } else {
            return null;
        }
    });

    return { command: command!, args, client, room };
}
