/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { type Readable } from "stream";
import stripAnsi from "strip-ansi";

export class Logger {
    private pages: Page[] = [];
    private logs: Record<string, string> = {};

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

    public async onTestFinished(testInfo: TestInfo) {
        if (testInfo.status !== "passed") {
            for (const id in this.logs) {
                if (!this.logs[id]) continue;
                await testInfo.attach(id, {
                    body: stripAnsi(this.logs[id]),
                    contentType: "text/plain",
                });
            }
        }
    }
}
