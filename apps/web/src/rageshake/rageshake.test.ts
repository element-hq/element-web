/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { ConsoleLogger, logUncaughtErrors } from "./rageshake";

describe("ConsoleLogger", () => {
    function logLine(prefix: "I" | "E", ...args: Parameters<ConsoleLogger["log"]>[1][]): string {
        const consoleLogger = new ConsoleLogger();
        consoleLogger.log(prefix, ...args);
        return consoleLogger.flush();
    }

    it.each([
        ["a token with only letters, digits and dashes", "token=abc-123", "token=xxxxx"],
        ["a token containing underscores", "access_token=syt_abc_123", "access_token=xxxxx"],
        ["a loginToken, keeping its case", "?loginToken=syl_abc_123&other=1", "?loginToken=xxxxx&other=1"],
        ["a token followed by a fragment", "?loginToken=syl_abc#/home", "?loginToken=xxxxx#/home"],
        ["a token in quotes", `"https://hs/?access_token=syt_abc"`, `"https://hs/?access_token=xxxxx"`],
        ["each of several tokens", "a?token=one_1 b?token=two_2", "a?token=xxxxx b?token=xxxxx"],
    ])("removes %s", (_, text, expected) => {
        const line = logLine("I", "Opening URL:", text);
        expect(line).toContain(`Opening URL: ${expected}\n`);
    });

    it("logs an error's message and stack", () => {
        const error = new Error("Something broke");
        const line = logLine("E", "Failed:", error);
        expect(line).toContain("Failed: Something broke");
        expect(line).toContain(error.stack);
        expect(line).not.toContain("Caused by");
    });

    it("logs the cause of an error", () => {
        const cause = new DOMException("Failed to read large IndexedDB value", "UnknownError");
        const line = logLine("E", new Error("selectQuery failed for sync", { cause }));
        expect(line).toContain("selectQuery failed for sync");
        expect(line).toContain("\nCaused by: Failed to read large IndexedDB value (UnknownError | 0)");
    });

    it("logs a chain of causes", () => {
        const root = new Error("root");
        const middle = new Error("middle", { cause: root });
        const line = logLine("E", new Error("top", { cause: middle }));
        expect(line.indexOf("Caused by: middle")).toBeGreaterThan(line.indexOf("top"));
        expect(line.indexOf("Caused by: root")).toBeGreaterThan(line.indexOf("Caused by: middle"));
    });

    it("logs a cause which is not an error", () => {
        expect(logLine("E", new Error("top", { cause: { code: 42 } }))).toContain('Caused by: {"code":42}');
        expect(logLine("E", new Error("top", { cause: "a reason" }))).toContain("Caused by: a reason");
    });

    it("stops following a chain of causes which loops", () => {
        const error = new Error("loop");
        error.cause = error;
        const line = logLine("E", error);
        expect(line.match(/Caused by: loop/g)).toHaveLength(5);
    });
});

describe("logUncaughtErrors", () => {
    function setUp(): { target: Window; consoleLogger: ConsoleLogger } {
        const target = new EventTarget() as unknown as Window;
        const consoleLogger = new ConsoleLogger();
        logUncaughtErrors(target, consoleLogger);
        return { target, consoleLogger };
    }

    it("logs an uncaught error with its stack", () => {
        const { target, consoleLogger } = setUp();
        const error = new Error("Something broke");

        target.dispatchEvent(new ErrorEvent("error", { error, message: error.message }));

        const line = consoleLogger.flush();
        expect(line).toMatch(/^\S+ E Uncaught error: Something broke\n/);
        expect(line.endsWith(`\n${error.stack}\n`)).toBe(true);
    });

    it("logs where an uncaught error happened when the error itself isn't available", () => {
        const { target, consoleLogger } = setUp();

        target.dispatchEvent(
            new ErrorEvent("error", { message: "Script error.", filename: "https://cdn/x.js", lineno: 3, colno: 7 }),
        );

        expect(consoleLogger.flush()).toMatch(/^\S+ E Uncaught error: Script error\. at https:\/\/cdn\/x\.js:3:7\n$/);
    });

    it("logs an unhandled promise rejection with the reason's stack", () => {
        const { target, consoleLogger } = setUp();
        const reason = new Error("Request failed");
        // Constructed by hand as the test environment has no PromiseRejectionEvent.
        const event = Object.assign(new Event("unhandledrejection"), { reason });

        target.dispatchEvent(event);

        const line = consoleLogger.flush();
        expect(line).toMatch(/^\S+ E Unhandled promise rejection: Request failed\n/);
        expect(line).toContain(reason.stack);
    });
});
