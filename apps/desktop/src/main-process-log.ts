/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fs from "node:fs";
import path from "node:path";
import { format } from "node:util";

/** The console functions we copy to the log file, and the level each is written with. */
const consoleFunctionsToLevels = {
    log: "I",
    info: "I",
    warn: "W",
    error: "E",
    debug: "D",
} as const;
type LogFunctionName = keyof typeof consoleFunctionsToLevels;

/** The size at which the log file is moved aside and a new one started. */
const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024;

/** The most lines to hold before the log file is opened, so a broken startup can't use unbounded memory. */
const MAX_PENDING_LINES = 1000;

export const LOG_FILE_NAME = "main.log";
export const ROTATED_LOG_FILE_NAME = "main.1.log";

/**
 * Matches the value of a `token=` URL parameter, e.g. a `loginToken` in a deep link, so it can be removed
 * before it's written to the log file.
 */
const TOKEN_PATTERN = /(token=)[^&#\s"']+/gi;

/** What {@link getStartupMessage} describes. */
export interface StartupInfo {
    /** The app's name, e.g. "Element". */
    name: string;
    /** The app's version. */
    version: string;
    pid: number;
    platform: string;
    arch: string;
    electronVersion: string;
    /** The process's command line, of which only the flag names are logged. */
    argv: string[];
}

/**
 * Make the line written at the start of each run, which marks where the run starts in the log file and
 * records the version which wrote the lines after it, as the file is kept across runs and updates.
 *
 * Only the names of command line flags are included: other arguments, such as deep links, and flag values
 * may contain secrets.
 */
export function getStartupMessage(info: StartupInfo): string {
    const flags = info.argv.filter((arg) => arg.startsWith("-")).map((arg) => arg.split("=")[0]);
    return (
        `===== ${info.name} ${info.version} starting ` +
        `(pid ${info.pid}, ${info.platform} ${info.arch}, Electron ${info.electronVersion}, ` +
        `flags: ${flags.join(" ") || "none"}) =====`
    );
}

/**
 * Copies the main process's console output to a log file, so it can be attached to bug reports.
 *
 * Lines are written synchronously so they survive `app.exit()` and crashes, which are when they
 * matter most. The file is kept to two generations of at most {@link MAX_LOG_FILE_SIZE} each.
 */
export class MainProcessLog {
    private dir?: string;
    private fd?: number;
    private size = 0;
    private pending: string[] = [];
    /** The console functions as they were before {@link patchConsole}, used to report our own failures. */
    private readonly originalFunctions: Partial<Record<LogFunctionName, (...args: unknown[]) => void>> = {};

    /**
     * Wrap the console functions so their output is also written to the log file.
     *
     * Lines logged before {@link start} is called are held in memory and written once it is.
     */
    public patchConsole(consoleObj: Console): void {
        for (const fnName of Object.keys(consoleFunctionsToLevels) as LogFunctionName[]) {
            const originalFn = consoleObj[fnName].bind(consoleObj);
            this.originalFunctions[fnName] = originalFn;
            consoleObj[fnName] = (...args: unknown[]): void => {
                this.write(consoleFunctionsToLevels[fnName], args);
                originalFn(...args);
            };
        }
    }

    /**
     * Open the log file, write the startup line, then any lines logged so far.
     *
     * @param dir - the directory to keep the log files in.
     * @param startupMessage - the line to mark the start of this run with, from {@link getStartupMessage}.
     */
    public start(dir: string, startupMessage: string): void {
        this.dir = dir;
        try {
            fs.mkdirSync(dir, { recursive: true });
            this.open();
        } catch (e) {
            this.originalFunctions.error?.("Failed to open the main process log file", e);
            this.pending = [];
            return;
        }
        // Written ahead of the lines logged before now so that it marks the start of the run, even though
        // its timestamp is a little later than theirs.
        this.append(this.formatLine("I", [startupMessage]));
        for (const line of this.pending) this.append(line);
        this.pending = [];
    }

    /**
     * Read the log files, oldest line first.
     *
     * Never rejects: a file which can't be read is left out, so a bug report can still be sent.
     *
     * @returns the contents of the log files, or an empty string if there are none.
     */
    public async read(): Promise<string> {
        if (!this.dir) return "";
        let lines = "";
        for (const name of [ROTATED_LOG_FILE_NAME, LOG_FILE_NAME]) {
            try {
                lines += await fs.promises.readFile(path.join(this.dir, name), "utf8");
            } catch (e) {
                if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
                    console.error(`Failed to read the main process log file ${name}`, e);
                }
            }
        }
        return lines;
    }

    /**
     * Delete everything logged so far, as the renderer's logs are when its storage is cleared.
     */
    public clear(): void {
        if (!this.dir) return;
        try {
            fs.rmSync(path.join(this.dir, ROTATED_LOG_FILE_NAME), { force: true });
            if (this.fd !== undefined) {
                // The file is open for appending, so new lines go to the start of the emptied file.
                fs.ftruncateSync(this.fd, 0);
                this.size = 0;
            } else {
                fs.rmSync(path.join(this.dir, LOG_FILE_NAME), { force: true });
            }
        } catch (e) {
            this.originalFunctions.error?.("Failed to clear the main process log file", e);
        }
    }

    private formatLine(level: string, args: unknown[]): string {
        const line = `${new Date().toISOString()} ${level} ${format(...args)}\n`;
        return line.replace(TOKEN_PATTERN, "$1xxxxx");
    }

    private write(level: string, args: unknown[]): void {
        const line = this.formatLine(level, args);
        if (this.fd !== undefined) {
            this.append(line);
        } else if (this.dir === undefined && this.pending.length < MAX_PENDING_LINES) {
            this.pending.push(line);
        }
    }

    private open(): void {
        const file = path.join(this.dir!, LOG_FILE_NAME);
        this.fd = fs.openSync(file, "a");
        this.size = fs.fstatSync(this.fd).size;
        if (this.size >= MAX_LOG_FILE_SIZE) this.rotate();
    }

    /** Move the current log file aside and start a new one. */
    private rotate(): void {
        fs.closeSync(this.fd!);
        this.fd = undefined;
        fs.renameSync(path.join(this.dir!, LOG_FILE_NAME), path.join(this.dir!, ROTATED_LOG_FILE_NAME));
        this.fd = fs.openSync(path.join(this.dir!, LOG_FILE_NAME), "a");
        this.size = 0;
    }

    private append(line: string): void {
        try {
            this.size += fs.writeSync(this.fd!, line);
            if (this.size >= MAX_LOG_FILE_SIZE) this.rotate();
        } catch (e) {
            // Stop writing rather than fail every console call, e.g. when the disk is full. Report it
            // with the original console function so this doesn't try to write to the file again.
            if (this.fd !== undefined) {
                try {
                    fs.closeSync(this.fd);
                } catch {
                    // Already failing; nothing more to do.
                }
            }
            this.fd = undefined;
            this.originalFunctions.error?.("Failed to write to the main process log file, disabling it", e);
        }
    }
}

/** The log for this process. */
export const mainProcessLog = new MainProcessLog();
