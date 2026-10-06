/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect } from "vitest";
import { type IContent } from "matrix-js-sdk/src/matrix";

import { setUpCommandTest } from "./__mocks__";

describe("/spoiler", () => {
    const roomId = "!room:example.com";

    it("should return usage if no args", () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        expect(command.run(client, roomId, null, undefined).error).toBe(command.getUsage());
    });

    it("should wrap plain text in a spoiler span", async () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        const content = (await command.run(client, roomId, null, "plain text").promise) as IContent;
        // Single-line plain text is not wrapped in <p> by the markdown serializer
        expect(content.formatted_body).toBe("<span data-mx-spoiler>plain text</span>");
        expect(content.body).toBe("plain text");
    });

    it("should convert markdown to HTML inside the spoiler span", async () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        const content = (await command.run(client, roomId, null, "**secret** message").promise) as IContent;
        // Single-line markdown: no <p> wrapper, ** becomes <strong>
        expect(content.formatted_body).toBe("<span data-mx-spoiler><strong>secret</strong> message</span>");
        expect(content.body).toBe("**secret** message");
    });

    it("should preserve the plain text body unchanged", async () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        const content = (await command.run(client, roomId, null, "just text").promise) as IContent;
        expect(content.body).toBe("just text");
        expect(content.formatted_body).toBe("<span data-mx-spoiler>just text</span>");
    });
});
