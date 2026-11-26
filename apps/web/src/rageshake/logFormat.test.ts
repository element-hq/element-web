/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { formatLogArg } from "./logFormat";

describe("formatLogArg", () => {
    it("formats a DOMException with its name and code", () => {
        expect(formatLogArg(new DOMException("Data lost", "NotReadableError"))).toBe(
            "Data lost (NotReadableError | 0)",
        );
    });

    it("formats an error with its message and stack", () => {
        const error = new Error("Something broke");
        expect(formatLogArg(error)).toBe(`Something broke\n${error.stack}`);
    });

    it("formats an object as JSON, even if it refers to itself", () => {
        const obj: Record<string, unknown> = { count: 2 };
        obj.self = obj;
        expect(formatLogArg(obj)).toBe('{"count":2,"self":"<$ cycle-trimmed $>"}');
    });

    it("leaves other values as they are", () => {
        expect(formatLogArg("text")).toBe("text");
        expect(formatLogArg(3)).toBe(3);
    });
});
