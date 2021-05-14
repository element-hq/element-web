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

import { string } from "prop-types";
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

        if (!performance.getEntriesByName(key).length) {
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
    static stop(name: string, id?: string): void {
        if (!supportsPerformanceApi()) {
            return;
        }
        const key = buildKey(name, id);
        if (!performance.getEntriesByName(START_PREFIX + key).length) {
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
        if (!supportsPerformanceApi()) {
            return;
        }

        if (!name && !type) {
            return performance.getEntries();
        } else if (!name) {
            return performance.getEntriesByType(type);
        } else {
            return performance.getEntriesByName(name, type);
        }
    }
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
