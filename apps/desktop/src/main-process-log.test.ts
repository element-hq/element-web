/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getStartupMessage, LOG_FILE_NAME, MainProcessLog, ROTATED_LOG_FILE_NAME } from "./main-process-log.js";

const STARTUP = "===== starting =====";
/** The startup line as written to the log file. */
const STARTUP_LINE = String.raw`\S+ I ===== starting =====\n`;

function makeConsole(): Console {
    return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Console;
}

describe("MainProcessLog", () => {
    let dir: string;
    let log: MainProcessLog;
    let fakeConsole: Console;
    let original: Console;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(tmpdir(), "main-process-log-"));
        log = new MainProcessLog();
        fakeConsole = makeConsole();
        original = { ...fakeConsole };
        log.patchConsole(fakeConsole);
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it("writes console output to the log file and still passes it to the console", async () => {
        log.start(dir, STARTUP);
        fakeConsole.warn("Something odd", { count: 2 });

        expect(original.warn).toHaveBeenCalledWith("Something odd", { count: 2 });
        expect(await log.read()).toMatch(
            new RegExp(String.raw`^${STARTUP_LINE}\d{4}-\d\d-\d\dT[\d:.]+Z W Something odd \{ count: 2 \}\n$`),
        );
    });

    it("writes the cause of an error", async () => {
        log.start(dir, STARTUP);
        fakeConsole.error("Failed:", new Error("top", { cause: new Error("underlying") }));

        const lines = await log.read();
        expect(lines).toContain(" E Failed: Error: top");
        expect(lines).toContain("[cause]: Error: underlying");
    });

    it("writes lines logged before it was started", async () => {
        fakeConsole.log("early");
        log.start(dir, STARTUP);
        fakeConsole.log("late");

        const lines = await log.read();
        expect(lines).toMatch(new RegExp(String.raw`^${STARTUP_LINE}\S+ I early\n\S+ I late\n$`));
    });

    it("appends to an existing log file", async () => {
        fs.writeFileSync(path.join(dir, LOG_FILE_NAME), "from last run\n");
        log.start(dir, STARTUP);
        fakeConsole.log("this run");

        expect(await log.read()).toMatch(new RegExp(String.raw`^from last run\n${STARTUP_LINE}\S+ I this run\n$`));
    });

    it("moves a full log file aside and reads both, oldest first", async () => {
        fs.writeFileSync(path.join(dir, LOG_FILE_NAME), "x".repeat(5 * 1024 * 1024) + "\n");
        fs.writeFileSync(path.join(dir, ROTATED_LOG_FILE_NAME), "oldest\n");
        log.start(dir, STARTUP);
        fakeConsole.log("newest");

        expect(fs.readFileSync(path.join(dir, LOG_FILE_NAME), "utf8")).toMatch(/ I newest\n$/);
        const lines = await log.read();
        expect(lines.startsWith("xxx")).toBe(true);
        expect(lines).not.toContain("oldest");
        expect(lines).toMatch(/ I newest\n$/);
    });

    it("moves the log file aside once it fills up while running", () => {
        log.start(dir, STARTUP);
        fakeConsole.log("x".repeat(5 * 1024 * 1024));
        fakeConsole.log("next");

        expect(fs.readFileSync(path.join(dir, ROTATED_LOG_FILE_NAME), "utf8")).toMatch(/ I x+\n$/);
        expect(fs.readFileSync(path.join(dir, LOG_FILE_NAME), "utf8")).toMatch(/^\S+ I next\n$/);
    });

    it("clears the log files and keeps logging", async () => {
        fs.writeFileSync(path.join(dir, ROTATED_LOG_FILE_NAME), "older\n");
        log.start(dir, STARTUP);
        fakeConsole.log("before clearing");

        log.clear();
        fakeConsole.log("after clearing");

        expect(fs.existsSync(path.join(dir, ROTATED_LOG_FILE_NAME))).toBe(false);
        expect(await log.read()).toMatch(/^\S+ I after clearing\n$/);
    });

    it("writes the startup line when the log file had to be moved aside first", () => {
        fs.writeFileSync(path.join(dir, LOG_FILE_NAME), "x".repeat(5 * 1024 * 1024) + "\n");
        log.start(dir, STARTUP);

        expect(fs.readFileSync(path.join(dir, LOG_FILE_NAME), "utf8")).toMatch(new RegExp(`^${STARTUP_LINE}$`));
    });

    it("removes tokens from the lines it writes", async () => {
        log.start(dir, STARTUP);
        fakeConsole.log("Opening URL: ", "element://vector/webapp/?loginToken=syl_abc_123&other=1#/home");

        const lines = await log.read();
        expect(lines).toContain("Opening URL:  element://vector/webapp/?loginToken=xxxxx&other=1#/home");
        expect(lines).not.toContain("syl_abc_123");
        // The token is still passed to the console unchanged.
        expect(original.log).toHaveBeenCalledWith(
            "Opening URL: ",
            "element://vector/webapp/?loginToken=syl_abc_123&other=1#/home",
        );
    });

    it("reads nothing before it is started", async () => {
        fakeConsole.log("early");
        expect(await log.read()).toBe("");
    });

    it("keeps passing output to the console when the log file can't be opened", () => {
        const file = path.join(dir, "not-a-directory");
        fs.writeFileSync(file, "");
        log.start(file, STARTUP);

        fakeConsole.log("still logged");

        expect(original.error).toHaveBeenCalledWith("Failed to open the main process log file", expect.any(Error));
        expect(original.log).toHaveBeenCalledWith("still logged");
    });
});

describe("getStartupMessage", () => {
    const info = {
        name: "Element",
        version: "1.12.36",
        pid: 1234,
        platform: "linux",
        arch: "x64",
        electronVersion: "40.1.0",
    };

    it("describes the app and lists only the names of its flags", () => {
        expect(
            getStartupMessage({
                ...info,
                argv: [
                    "/opt/Element/element-desktop",
                    "--profile=work",
                    "--hidden",
                    "element://vector/webapp/?loginToken=secret",
                ],
            }),
        ).toBe(
            "===== Element 1.12.36 starting (pid 1234, linux x64, Electron 40.1.0, flags: --profile --hidden) =====",
        );
    });

    it("says when there are no flags", () => {
        expect(getStartupMessage({ ...info, argv: ["/opt/Element/element-desktop"] })).toBe(
            "===== Element 1.12.36 starting (pid 1234, linux x64, Electron 40.1.0, flags: none) =====",
        );
    });
});
