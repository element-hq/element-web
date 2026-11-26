/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardLogsToRageshake, listenForWorkerLogs, type WorkerLogLine } from "./workerLogs";

function makeConsole(): Console {
    return { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as Console;
}

describe("worker logs", () => {
    let stopListening: (() => void) | undefined;

    afterEach(() => {
        stopListening?.();
        stopListening = undefined;
    });

    function nextLines(count: number): Promise<WorkerLogLine[]> {
        const lines: WorkerLogLine[] = [];
        return new Promise((resolve) => {
            stopListening = listenForWorkerLogs((line) => {
                lines.push(line);
                if (lines.length === count) resolve(lines);
            });
        });
    }

    it("sends a worker's console output to the page and still writes it to the worker's console", async () => {
        const workerConsole = makeConsole();
        const original = { ...workerConsole };
        const received = nextLines(2);

        forwardLogsToRageshake("test-worker", workerConsole);
        workerConsole.log("ready", 3);
        workerConsole.error("Failed:", new DOMException("gone", "NotReadableError"));

        const [ready, failed] = await received;
        expect(original.log).toHaveBeenCalledWith("ready", 3);
        expect(ready).toEqual({ source: "test-worker", level: "I", line: "ready 3" });
        expect(failed).toEqual({ source: "test-worker", level: "E", line: "Failed: gone (NotReadableError | 0)" });
    });

    it("ignores messages on the channel which aren't log lines", async () => {
        const received = nextLines(1);
        const channel = new BroadcastChannel("mx_rageshake_worker_logs");
        channel.postMessage({ unexpected: true });
        channel.postMessage({ source: "test-worker", level: "W", line: "valid" });

        await expect(received).resolves.toEqual([{ source: "test-worker", level: "W", line: "valid" }]);
        channel.close();
    });
});
