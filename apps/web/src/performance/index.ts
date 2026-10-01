/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

import { PerformanceEntryNames } from "./entry-names";

interface GetEntriesOptions {
    name?: string;
    type?: string;
}

type PerformanceCallbackFunction = (entry: PerformanceEntry[]) => void;

interface PerformanceDataListener {
    entryNames?: string[];
    callback: PerformanceCallbackFunction;
}

export default class PerformanceMonitor {
    private static _instance: PerformanceMonitor;

    private START_PREFIX = "start:";
    private STOP_PREFIX = "stop:";

    private listeners: PerformanceDataListener[] = [];
    private entries: PerformanceEntry[] = [];

    public static get instance(): PerformanceMonitor {
        if (!PerformanceMonitor._instance) {
            PerformanceMonitor._instance = new PerformanceMonitor();
        }
        return PerformanceMonitor._instance;
    }

    /**
     * Starts a performance recording
     * @param name Name of the recording
     * @param id Specify an identifier appended to the measurement name
     * @returns {void}
     */
    public start(name: string, id?: string): void {
        if (!this.supportsPerformanceApi()) {
            return;
        }
        const key = this.buildKey(name, id);

        if (performance.getEntriesByName(this.START_PREFIX + key).length > 0) {
            logger.warn(`Recording already started for: ${name}`);
            return;
        }

        performance.mark(this.START_PREFIX + key);
    }

    /**
     * Stops a performance recording and stores delta duration
     * with the start marker
     * @param name Name of the recording
     * @param id Specify an identifier appended to the measurement name
     * @returns The measurement
     */
    public stop(name: string, id?: string): PerformanceEntry | undefined {
        if (!this.supportsPerformanceApi()) {
            return;
        }
        const key = this.buildKey(name, id);
        if (performance.getEntriesByName(this.START_PREFIX + key).length === 0) {
            logger.warn(`No recording started for: ${name}`);
            return;
        }

        performance.mark(this.STOP_PREFIX + key);
        performance.measure(key, this.START_PREFIX + key, this.STOP_PREFIX + key);

        this.clear(name, id);

        const measurement = performance.getEntriesByName(key).pop()!;

        // Keeping a reference to all PerformanceEntry created
        // by this abstraction for historical events collection
        // when adding a data callback
        this.entries.push(measurement);

        this.listeners.forEach((listener) => {
            if (this.shouldEmit(listener, measurement)) {
                listener.callback([measurement]);
            }
        });

        return measurement;
    }

    public clear(name: string, id?: string): void {
        if (!this.supportsPerformanceApi()) {
            return;
        }
        const key = this.buildKey(name, id);
        performance.clearMarks(this.START_PREFIX + key);
        performance.clearMarks(this.STOP_PREFIX + key);
    }

    public getEntries({ name, type }: GetEntriesOptions = {}): PerformanceEntry[] {
        return this.entries.filter((entry) => {
            const satisfiesName = !name || entry.name === name;
            const satisfiedType = !type || entry.entryType === type;
            return satisfiesName && satisfiedType;
        });
    }

    public addPerformanceDataCallback(listener: PerformanceDataListener, buffer = false): void {
        this.listeners.push(listener);
        if (buffer) {
            const toEmit = this.entries.filter((entry) => this.shouldEmit(listener, entry));
            if (toEmit.length > 0) {
                listener.callback(toEmit);
            }
        }
    }

    public removePerformanceDataCallback(callback?: PerformanceCallbackFunction): void {
        if (!callback) {
            this.listeners = [];
        } else {
            this.listeners.splice(
                this.listeners.findIndex((listener) => listener.callback === callback),
                1,
            );
        }
    }

    /**
     * Tor browser does not support the Performance API
     * @returns {boolean} true if the Performance API is supported
     */
    private supportsPerformanceApi(): boolean {
        return performance !== undefined && performance.mark !== undefined;
    }

    private shouldEmit(listener: PerformanceDataListener, entry: PerformanceEntry): boolean {
        return !listener.entryNames || listener.entryNames.includes(entry.name);
    }

    /**
     * Internal utility to ensure consistent name for the recording
     * @param name Name of the recording
     * @param id Specify an identifier appended to the measurement name
     * @returns {string} a compound of the name and identifier if present
     */
    private buildKey(name: string, id?: string): string {
        const suffix = id ? `:${id}` : "";
        return `${name}${suffix}`;
    }
}

// Convenience exports
export { PerformanceEntryNames };

// Exposing those to the window object to bridge them from tests
window.mxPerformanceMonitor = PerformanceMonitor.instance;
window.mxPerformanceEntryNames = PerformanceEntryNames;
