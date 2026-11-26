/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { consoleFunctionsToLevels, formatLogArg, type LogFunctionName } from "./logFormat";

/**
 * The channel workers send their log lines on. One name is enough as the app only runs in one tab at a time.
 */
const WORKER_LOG_CHANNEL = "mx_rageshake_worker_logs";

/** A log line sent by a worker. */
export interface WorkerLogLine {
    /** The worker which logged the line, e.g. "indexeddb-worker". */
    source: string;
    /** The level the line was logged at, as used in rageshake logs. */
    level: string;
    /** The formatted line. */
    line: string;
}

function isWorkerLogLine(data: unknown): data is WorkerLogLine {
    const line = data as WorkerLogLine;
    return (
        typeof data === "object" &&
        data !== null &&
        typeof line.source === "string" &&
        typeof line.level === "string" &&
        typeof line.line === "string"
    );
}

/**
 * Send this worker's console output to the page, so it is included in rageshakes.
 *
 * Call it at the top of a worker or service worker's entry point. Output is still written to the
 * worker's own console. Lines logged while no page is listening, such as by a service worker with
 * no tab open, are lost.
 *
 * @param source - the name to show for the worker in the logs.
 * @param consoleObj - the console to forward.
 */
export function forwardLogsToRageshake(source: string, consoleObj: Console = console): void {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(WORKER_LOG_CHANNEL);

    for (const fnName of Object.keys(consoleFunctionsToLevels) as LogFunctionName[]) {
        const originalFn = consoleObj[fnName].bind(consoleObj);
        consoleObj[fnName] = (...args: unknown[]): void => {
            originalFn(...args);
            try {
                const line = args.map((arg) => formatLogArg(arg)).join(" ");
                channel.postMessage({ source, level: consoleFunctionsToLevels[fnName], line } satisfies WorkerLogLine);
            } catch {
                // Logging must never break the worker, and there is nowhere else to report this.
            }
        };
    }
}

/**
 * Listen for log lines sent by workers with {@link forwardLogsToRageshake}.
 *
 * @param onLine - called with each line received.
 * @returns a function which stops listening.
 */
export function listenForWorkerLogs(onLine: (line: WorkerLogLine) => void): () => void {
    if (typeof BroadcastChannel === "undefined") return () => {};
    const channel = new BroadcastChannel(WORKER_LOG_CHANNEL);
    channel.onmessage = (event: MessageEvent<unknown>): void => {
        if (isWorkerLogLine(event.data)) onLine(event.data);
    };
    return () => channel.close();
}
