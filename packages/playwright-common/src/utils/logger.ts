/*
Copyright 2024-2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { type Readable } from "node:stream";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import stripAnsi from "strip-ansi";

/**
 * Environment variable which, when set to any non-empty value, captures logs for every test rather than only for
 * failing ones. Container logs are also written to `<container>.log` in the test's output directory, so they can be
 * searched and processed after the run, e.g. to find slow homeserver requests.
 */
const CAPTURE_LOGS_ENV_VAR = "PLAYWRIGHT_CAPTURE_LOGS";

/**
 * A logger that captures console logs from pages and testcontainers.
 */
export class Logger {
    private pages: Page[] = [];
    private logs: Record<string, string> = {};

    /**
     * Get a consumer function that captures logs for a given container.
     * @param container - the human-readable name of the container.
     */
    public getConsumer(container: string) {
        this.logs[container] = "";
        return (stream: Readable) => {
            stream.on("data", (chunk) => {
                this.logs[container] += chunk.toString();
            });
            stream.on("err", (chunk) => {
                this.logs[container] += "ERR " + chunk.toString();
            });
        };
    }

    /**
     * Hook to call when a test starts.
     * @param context - the browser context of the test.
     */
    public async onTestStarted(context: BrowserContext) {
        this.pages = [];
        for (const id in this.logs) {
            if (id.startsWith("page-")) {
                delete this.logs[id];
            } else {
                this.logs[id] = "";
            }
        }

        context.on("console", (msg) => {
            const page = msg.page();
            if (!page) return;
            let pageIdx = this.pages.indexOf(page);
            if (pageIdx === -1) {
                this.pages.push(page);
                pageIdx = this.pages.length - 1;
                this.logs[`page-${pageIdx}`] = `Console logs for page with URL: ${page.url()}\n\n`;
            }
            const type = msg.type();
            const text = msg.text();
            this.logs[`page-${pageIdx}`] += `${type}: ${text}\n`;
        });
    }

    /**
     * Hook to call when a test finishes.
     * Attaches the captured logs to the test if it did not pass, or always if `PLAYWRIGHT_CAPTURE_LOGS` is set.
     * @param testInfo - the info about the test that just finished.
     */
    public async onTestFinished(testInfo: TestInfo) {
        const captureLogs = !!process.env[CAPTURE_LOGS_ENV_VAR];
        if (testInfo.status === "passed" && !captureLogs) return;

        for (const id in this.logs) {
            if (!this.logs[id]) continue;
            const body = stripAnsi(this.logs[id]);

            if (captureLogs && !id.startsWith("page-")) {
                const logPath = testInfo.outputPath(`${id}.log`);
                await mkdir(path.dirname(logPath), { recursive: true });
                await writeFile(logPath, body);
                await testInfo.attach(id, { path: logPath, contentType: "text/plain" });
            } else {
                await testInfo.attach(id, { body, contentType: "text/plain" });
            }
        }
    }
}
