/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { ConsoleLogger } from "./rageshake";

function logLine(...args: Parameters<ConsoleLogger["log"]>[1][]): string {
    const consoleLogger = new ConsoleLogger();
    consoleLogger.log("E", ...args);
    return consoleLogger.flush();
}

describe("ConsoleLogger", () => {
    it("logs an error's message and stack", () => {
        const error = new Error("Something broke");
        const line = logLine("Failed:", error);
        expect(line).toContain("Failed: Something broke");
        expect(line).toContain(error.stack);
        expect(line).not.toContain("Caused by");
    });

    it("logs the cause of an error", () => {
        const cause = new DOMException("Failed to read large IndexedDB value", "UnknownError");
        const line = logLine(new Error("selectQuery failed for sync", { cause }));
        expect(line).toContain("selectQuery failed for sync");
        expect(line).toContain("\nCaused by: Failed to read large IndexedDB value (UnknownError | 0)");
    });

    it("logs a chain of causes", () => {
        const root = new Error("root");
        const middle = new Error("middle", { cause: root });
        const line = logLine(new Error("top", { cause: middle }));
        expect(line.indexOf("Caused by: middle")).toBeGreaterThan(line.indexOf("top"));
        expect(line.indexOf("Caused by: root")).toBeGreaterThan(line.indexOf("Caused by: middle"));
    });

    it("logs a cause which is not an error", () => {
        expect(logLine(new Error("top", { cause: { code: 42 } }))).toContain('Caused by: {"code":42}');
        expect(logLine(new Error("top", { cause: "a reason" }))).toContain("Caused by: a reason");
    });

    it("stops following a chain of causes which loops", () => {
        const error = new Error("loop");
        error.cause = error;
        const line = logLine(error);
        expect(line.match(/Caused by: loop/g)).toHaveLength(5);
    });
});
