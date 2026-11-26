/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { ConsoleLogger, logUncaughtErrors } from "./rageshake";

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
