/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { Room, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { type Command } from "../../../src/slash-commands/command";
import { getCommand } from "../../../src/slash-commands/SlashCommands";
import { stubClient } from "../../test-utils";
import { SdkContextClass } from "../../../src/contexts/SDKContext";
import { LocalRoom } from "../../../src/models/LocalRoom";

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
    jest.clearAllMocks();

    // TODO: if getCommand took a MatrixClient argument, we could use
    // createTestClient here instead of stubClient (i.e. avoid setting
    // MatrixClientPeg.)
    const client = stubClient();
    const { cmd: command, args } = getCommand(roomId, input);

    let room: Room;

    if (roomIsLocal) {
        room = new LocalRoom(roomId, client, client.getSafeUserId());
    } else {
        room = new Room(roomId, client, client.getSafeUserId());
    }

    jest.spyOn(SdkContextClass.instance.roomViewStore, "getRoomId").mockReturnValue(roomId);

    mocked(client.getRoom).mockImplementation((rId: string): Room | null => {
        if (rId === roomId) {
            return room;
        } else {
            return null;
        }
    });

    return { command: command!, args, client, room };
}
