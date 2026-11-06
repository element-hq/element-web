/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type BrowserContext, type TestInfo } from "@playwright/test";
import { PassThrough } from "node:stream";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Logger } from "./logger.js";
import { SourceMapper } from "./sourcemaps.js";

describe("Logger", () => {
    let outputDir: string;
    let logger: Logger;

    beforeEach(async () => {
        outputDir = await mkdtemp(path.join(tmpdir(), "logger-test-"));
        logger = new Logger();

        const stream = new PassThrough();
        logger.getConsumer("homeserver")(stream);
        await logger.onTestStarted({ on: vi.fn() } as unknown as BrowserContext);
        stream.write("\u001b[32mProcessed request\u001b[0m\n");
    });

    afterEach(async () => {
        vi.unstubAllEnvs();
        await rm(outputDir, { recursive: true, force: true });
    });

    function makeTestInfo(status: TestInfo["status"]): TestInfo {
        return {
            status,
            outputPath: (name: string) => path.join(outputDir, "test-dir", name),
            attach: vi.fn(),
        } as unknown as TestInfo;
    }

    it("does not attach logs for a passing test", async () => {
        vi.stubEnv("PLAYWRIGHT_CAPTURE_LOGS", "");
        const testInfo = makeTestInfo("passed");

        await logger.onTestFinished(testInfo);

        expect(testInfo.attach).not.toHaveBeenCalled();
    });

    it("maps script locations in page logs, but not container logs, for a failing test", async () => {
        vi.stubEnv("PLAYWRIGHT_CAPTURE_LOGS", "");
        const mapLocations = vi.spyOn(SourceMapper.prototype, "mapLocations").mockResolvedValue("mapped page logs");
        let onConsole!: (msg: unknown) => void;
        await logger.onTestStarted({
            on: vi.fn((_event: string, listener: typeof onConsole) => (onConsole = listener)),
        } as unknown as BrowserContext);
        const page = { url: () => "http://localhost:8080/" };
        onConsole({ page: () => page, type: () => "error", text: () => "Error: oops" });
        // Starting the test cleared the container log written in beforeEach
        const stream = new PassThrough();
        logger.getConsumer("homeserver")(stream);
        stream.write("Processed request\n");
        const testInfo = makeTestInfo("failed");

        await logger.onTestFinished(testInfo);

        expect(mapLocations).toHaveBeenCalledWith(expect.stringContaining("error: Error: oops"));
        expect(testInfo.attach).toHaveBeenCalledWith("page-0", { body: "mapped page logs", contentType: "text/plain" });
        expect(testInfo.attach).toHaveBeenCalledWith("homeserver", {
            body: "Processed request\n",
            contentType: "text/plain",
        });
        mapLocations.mockRestore();
    });

    it("attaches logs inline for a failing test", async () => {
        vi.stubEnv("PLAYWRIGHT_CAPTURE_LOGS", "");
        const testInfo = makeTestInfo("failed");

        await logger.onTestFinished(testInfo);

        expect(testInfo.attach).toHaveBeenCalledWith("homeserver", {
            body: "Processed request\n",
            contentType: "text/plain",
        });
    });

    it("writes and attaches container logs for a passing test when PLAYWRIGHT_CAPTURE_LOGS is set", async () => {
        vi.stubEnv("PLAYWRIGHT_CAPTURE_LOGS", "1");
        const testInfo = makeTestInfo("passed");

        await logger.onTestFinished(testInfo);

        const logPath = path.join(outputDir, "test-dir", "homeserver.log");
        expect(await readFile(logPath, "utf8")).toEqual("Processed request\n");
        expect(testInfo.attach).toHaveBeenCalledWith("homeserver", { path: logPath, contentType: "text/plain" });
    });
});
