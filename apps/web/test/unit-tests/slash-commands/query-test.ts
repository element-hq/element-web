/*
 * Copyright 2026 hayaksi1
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { setUpCommandTest } from "./utils";
import * as createRoom from "../../../src/createRoom";
import dis from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";

describe("/query", () => {
    const roomId = "!room:example.com";
    const dmRoomId = "!dm:example.com";

    beforeEach(() => {
        jest.spyOn(createRoom, "ensureDMExists").mockResolvedValue(dmRoomId);
        jest.spyOn(dis, "dispatch").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should return usage if no args", () => {
        const { client, command } = setUpCommandTest(roomId, "/query");
        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
    });

    it("should open a DM with the user we specify", async () => {
        const { client, command, args } = setUpCommandTest(roomId, "/query @alice:example.com");

        await command.run(client, roomId, null, args).promise;

        expect(createRoom.ensureDMExists).toHaveBeenCalledWith(client, "@alice:example.com");
        expect(dis.dispatch).toHaveBeenCalledWith(
            expect.objectContaining({ action: Action.ViewRoom, room_id: dmRoomId }),
        );
    });

    it.each([
        ["trailing text", "/query @alice:example.com hello there"],
        ["a leading space in the localpart", "/query @ alice:example.com"],
        ["no colon", "/query @alice"],
        ["no sigil", "/query alice:example.com"],
    ])("should return usage for a user ID with %s", (_name: string, input: string) => {
        const { client, command, args } = setUpCommandTest(roomId, input);

        expect(command.run(client, roomId, null, args).error).toBe(command.getUsage());
        expect(createRoom.ensureDMExists).not.toHaveBeenCalled();
    });
});
