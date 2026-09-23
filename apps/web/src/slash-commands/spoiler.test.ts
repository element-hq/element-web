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

    it("should wrap plain text in a spoiler span", () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        const result = command.run(client, roomId, null, "plain text");
        expect(result.error).toBeUndefined();
        const content = result.value;
        expect(content?.formatted_body).toContain("<span data-mx-spoiler>");
        expect(content?.formatted_body).toContain("plain text");
    });

    it("should convert markdown bold to HTML inside the spoiler span", () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        const result = command.run(client, roomId, null, "**secret** message");
        expect(result.error).toBeUndefined();
        const content = result.value;
        // Markdown should be serialized to HTML — raw ** chars must not appear
        expect(content?.formatted_body).not.toContain("**secret**");
        expect(content?.formatted_body).toContain("<strong>");
        expect(content?.formatted_body).toContain("<span data-mx-spoiler>");
    });

    it("should not double-escape plain text (no markdown)", () => {
        const { client, command } = setUpCommandTest(roomId, `/spoiler`);
        const result = command.run(client, roomId, null, "just text");
        const content = result.value;
        expect(content?.body).toBe("just text");
        expect(content?.formatted_body).toContain("just text");
    });
});
