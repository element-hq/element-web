/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TestInfo } from "@playwright/test";
import { Readable } from "stream";
import stripAnsi from "strip-ansi";

export class ContainerLogger {
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

    public async testStarted(testInfo: TestInfo) {
        for (const container in this.logs) {
            this.logs[container] = "";
        }
    }

    public async testFinished(testInfo: TestInfo) {
        if (testInfo.status !== "passed") {
            for (const container in this.logs) {
                await testInfo.attach(container, {
                    body: stripAnsi(this.logs[container]),
                    contentType: "text/plain",
                });
            }
        }
    }
}
