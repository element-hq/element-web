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
