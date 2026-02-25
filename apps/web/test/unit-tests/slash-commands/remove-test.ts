/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { setUpCommandTest } from "./utils";

describe("/remove", () => {
    const roomId = "!room:example.com";

    it("should return usage if no args", () => {
        const { client, command } = setUpCommandTest(roomId, `/remove`);
        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
    });

    it("should kick the user we specify from this room", async () => {
        const { client, command, args } = setUpCommandTest(roomId, `/remove @u:s.co`);

        await command.run(client, roomId, null, args).promise;

        expect(client.kick).toHaveBeenCalledWith(roomId, "@u:s.co", undefined);
    });

    it("should provide the kick reason if we supply it", async () => {
        const { client, command, args } = setUpCommandTest(roomId, `/remove @u:s.co They were not very nice`);

        await command.run(client, roomId, null, args).promise;

        expect(client.kick).toHaveBeenCalledWith(roomId, "@u:s.co", "They were not very nice");
    });
});
