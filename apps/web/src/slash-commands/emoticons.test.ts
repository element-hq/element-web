/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2024 New Vector Ltd.
 * Copyright 2022 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import { setUpCommandTest } from "./__mocks__";

describe.each(["shrug", "tableflip", "unflip", "lenny"])("/%s", (commandName: string) => {
    const roomId = "!room:example.com";

    it("should match snapshot with no args", async () => {
        const { client, command } = setUpCommandTest(roomId, `/${commandName}`);
        await expect(command.run(client, roomId, null).promise).resolves.toMatchSnapshot();
    });

    it("should match snapshot with args", async () => {
        const { client, command } = setUpCommandTest(roomId, `/${commandName}`);

        const initialResult = await command.run(client, roomId, null, "this is a test message").promise;
        expect(initialResult).toMatchSnapshot();
        // We run this twice to ensure it doesn't stack the buffer
        await expect(command.run(client, roomId, null, "this is a test message").promise).resolves.toEqual(
            initialResult,
        );
    });
});
