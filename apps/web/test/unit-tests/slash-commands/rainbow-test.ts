/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { setUpCommandTest } from "./utils";

describe.each(["rainbow", "rainbowme"])("/%s", (commandName: string) => {
    const roomId = "!room:example.com";

    it("should return usage if no args", () => {
        const { client, command } = setUpCommandTest(roomId, `/${commandName}`);
        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
    });

    it("should make things rainbowy", async () => {
        const { client, command } = setUpCommandTest(roomId, `/${commandName}`);

        await expect(command.run(client, roomId, null, "this is a test message").promise).resolves.toMatchSnapshot();
    });
});
