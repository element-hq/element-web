/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { PerformanceEntryNames } from "./entry-names";

interface GetEntriesOptions {
    name?: string,
    type?: string,
}

type PerformanceCallbackFunction = (entry: PerformanceEntry[]) => void;

interface PerformanceDataListener {
    entryNames?: string[],
    callback: PerformanceCallbackFunction
}

export default class PerformanceMonitor {
    static _instance: PerformanceMonitor;

    private START_PREFIX = "start:"
    private STOP_PREFIX = "stop:"

    private listeners: PerformanceDataListener[] = []
    private entries: PerformanceEntry[] = []

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
    start(name: string, id?: string): void {
        if (!this.supportsPerformanceApi()) {
            return;
        }
        const key = this.buildKey(name, id);

        if (performance.getEntriesByName(this.START_PREFIX + key).length > 0) {
            console.warn(`Recording already started for: ${name}`);
            return;
        }

        performance.mark(this.START_PREFIX + key);
    }

    /**
     * Stops a performance recording and stores delta duration
     * with the start marker
     * @param name Name of the recording
     * @param id Specify an identifier appended to the measurement name
     * @returns {void}
     */
    stop(name: string, id?: string): PerformanceEntry {
        if (!this.supportsPerformanceApi()) {
            return;
        }
        const key = this.buildKey(name, id);
        if (performance.getEntriesByName(this.START_PREFIX + key).length === 0) {
            console.warn(`No recording started for: ${name}`);
            return;
        }

        performance.mark(this.STOP_PREFIX + key);
        performance.measure(
            key,
            this.START_PREFIX + key,
            this.STOP_PREFIX + key,
        );

        this.clear(name, id);

        const measurement = performance.getEntriesByName(key).pop();

        // Keeping a reference to all PerformanceEntry created
        // by this abstraction for historical events collection
        // when adding a data callback
        this.entries.push(measurement);

        this.listeners.forEach(listener => {
            if (this.shouldEmit(listener, measurement)) {
                listener.callback([measurement])
            }
        });

        return measurement;
    }

    clear(name: string, id?: string): void {
        if (!this.supportsPerformanceApi()) {
            return;
        }
        const key = this.buildKey(name, id);
        performance.clearMarks(this.START_PREFIX + key);
        performance.clearMarks(this.STOP_PREFIX + key);
    }

    getEntries({ name, type }: GetEntriesOptions = {}): PerformanceEntry[] {
        return this.entries.filter(entry => {
            const satisfiesName = !name || entry.name === name;
            const satisfiedType = !type || entry.entryType === type;
            return satisfiesName && satisfiedType;
        });
    }

    addPerformanceDataCallback(listener: PerformanceDataListener, buffer = false) {
        this.listeners.push(listener);
        if (buffer) {
            const toEmit = this.entries.filter(entry => this.shouldEmit(listener, entry));
            if (toEmit.length > 0) {
                listener.callback(toEmit);
            }
        }
    }

    removePerformanceDataCallback(callback?: PerformanceCallbackFunction) {
        if (!callback) {
            this.listeners = [];
        } else {
            this.listeners.splice(
                this.listeners.findIndex(listener => listener.callback === callback),
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
        return `${name}${id ? `:${id}` : ''}`;
    }
}


// Convenience exports
export {
    PerformanceEntryNames,
}

// Exposing those to the window object to bridge them from tests
window.mxPerformanceMonitor = PerformanceMonitor.instance;
window.mxPerformanceEntryNames = PerformanceEntryNames;
