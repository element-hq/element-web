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

const START_PREFIX = "start:";
const STOP_PREFIX = "stop:";

export {
    PerformanceEntryNames,
}

interface GetEntriesOptions {
    name?: string,
    type?: string,
}

type PerformanceCallbackFunction = (entry: PerformanceEntry[]) => void;

interface PerformanceDataListener {
    entryNames?: string[],
    callback: PerformanceCallbackFunction
}

let listeners: PerformanceDataListener[] = [];
const entries: PerformanceEntry[] = [];

export default class PerformanceMonitor {
    /**
     * Starts a performance recording
     * @param name Name of the recording
     * @param id Specify an identifier appended to the measurement name
     * @returns {void}
     */
    static start(name: string, id?: string): void {
        if (!supportsPerformanceApi()) {
            return;
        }
        const key = buildKey(name, id);

        if (performance.getEntriesByName(key).length > 0) {
            console.warn(`Recording already started for: ${name}`);
            return;
        }

        performance.mark(START_PREFIX + key);
    }

    /**
     * Stops a performance recording and stores delta duration
     * with the start marker
     * @param name Name of the recording
     * @param id Specify an identifier appended to the measurement name
     * @returns {void}
     */
    static stop(name: string, id?: string): PerformanceEntry {
        if (!supportsPerformanceApi()) {
            return;
        }
        const key = buildKey(name, id);
        if (performance.getEntriesByName(START_PREFIX + key).length === 0) {
            console.warn(`No recording started for: ${name}`);
            return;
        }

        performance.mark(STOP_PREFIX + key);
        performance.measure(
            key,
            START_PREFIX + key,
            STOP_PREFIX + key,
        );

        this.clear(name, id);

        const measurement = performance.getEntriesByName(key).pop();

        // Keeping a reference to all PerformanceEntry created
        // by this abstraction for historical events collection
        // when adding a data callback
        entries.push(measurement);

        listeners.forEach(listener => {
            if (shouldEmit(listener, measurement)) {
                listener.callback([measurement])
            }
        });

        return measurement;
    }

    static clear(name: string, id?: string): void {
        if (!supportsPerformanceApi()) {
            return;
        }
        const key = buildKey(name, id);
        performance.clearMarks(START_PREFIX + key);
        performance.clearMarks(STOP_PREFIX + key);
    }

    static getEntries({ name, type }: GetEntriesOptions = {}): PerformanceEntry[] {
        return entries.filter(entry => {
            const satisfiesName = !name || entry.name === name;
            const satisfiedType = !type || entry.entryType === type;
            return satisfiesName && satisfiedType;
        });
    }

    static addPerformanceDataCallback(listener: PerformanceDataListener, buffer = false) {
        listeners.push(listener);
        if (buffer) {
            const toEmit = entries.filter(entry => shouldEmit(listener, entry));
            if (toEmit.length > 0) {
                listener.callback(toEmit);
            }
        }
    }

    static removePerformanceDataCallback(callback?: PerformanceCallbackFunction) {
        if (!callback) {
            listeners = [];
        } else {
            listeners.splice(
                listeners.findIndex(listener => listener.callback === callback),
                1,
            );
        }
    }
}

function shouldEmit(listener: PerformanceDataListener, entry: PerformanceEntry): boolean {
    return !listener.entryNames || listener.entryNames.includes(entry.name);
}

/**
 * Tor browser does not support the Performance API
 * @returns {boolean} true if the Performance API is supported
 */
function supportsPerformanceApi(): boolean {
    return performance !== undefined && performance.mark !== undefined;
}

/**
 * Internal utility to ensure consistent name for the recording
 * @param name Name of the recording
 * @param id Specify an identifier appended to the measurement name
 * @returns {string} a compound of the name and identifier if present
 */
function buildKey(name: string, id?: string): string {
    return `${name}${id ? `:${id}` : ''}`;
}

window.mxPerformanceMonitor = PerformanceMonitor;
window.mxPerformanceEntryNames = PerformanceEntryNames;
