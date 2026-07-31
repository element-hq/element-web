/*
Copyright 2026 Element contributors

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
*/

import { describe, expect, it } from "vitest";

import { getRemoteEmojiSearchTerm } from "./RemoteEmojiProvider";

describe("getRemoteEmojiSearchTerm", () => {
    it("accepts Chinese keywords and explicit shortcodes", () => {
        expect(getRemoteEmojiSearchTerm("早安")).toBe("早安");
        expect(getRemoteEmojiSearchTerm(":wave")).toBe("wave");
    });

    it("requires two Latin characters without a colon", () => {
        expect(getRemoteEmojiSearchTerm("ok")).toBe("ok");
        expect(getRemoteEmojiSearchTerm("x")).toBeUndefined();
    });
});
