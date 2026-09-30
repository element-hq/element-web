/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";

import { setUpCommandTest } from "./__mocks__";

describe("/spoiler", () => {
    const roomId = "!room:example.com";

    it("should return usage if no args", () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
    });

    it("should wrap plain text in a spoiler span", async () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        await expect(command.run(client, roomId, null, "plain text").promise).resolves.toMatchSnapshot();
    });

    it("should convert markdown to HTML inside the spoiler span", async () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        await expect(command.run(client, roomId, null, "**secret** message").promise).resolves.toMatchSnapshot();
    });

    it("should preserve the plain text body unchanged", async () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        const result = await command.run(client, roomId, null, "just text").promise;
        expect(result).toMatchSnapshot();
    });
});
