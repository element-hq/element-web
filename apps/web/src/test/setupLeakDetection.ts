/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Fails a test which leaves behind registrations on the dispatcher or the settings store that pile up
 * across the test file.
 *
 * Each registration made while a test runs is recorded along with the code which made it. After each test,
 * if the test made a registration which is still alive, and the same code made one in an earlier test which
 * is also still alive, then whatever made the earlier one was never torn down: it holds on to everything it
 * references, and keeps reacting to dispatches and setting changes, for the rest of the test file.
 * Registrations which only come from one test are allowed, as that is how a lazily created singleton looks.
 *
 * The dispatcher and settings store are found through the globals they set when they are first imported,
 * rather than imported here, so that tests which never load them (or which mock them) are unaffected.
 */

import { afterEach, beforeEach, expect } from "vitest";

import type { MatrixDispatcher } from "../dispatcher/dispatcher";
import type SettingsStore from "../settings/SettingsStore";

interface Registration {
    /** Whether it is still registered. */
    isAlive: () => boolean;
    /** Where it was made from, as the chain of source locations which led to it. */
    origin: string;
    /** The name of the test which made it. */
    test: string;
}

// Matches stack frames in application code, rather than tests, test utilities or dependencies
const SOURCE_FRAME = /\/apps\/web\/src\/((?!test\/)[^:]+:\d+)/;
// Matches the frame of the test file which led to a registration
const TEST_FRAME = /\/apps\/web\/(src|test)\/([^:]+\.test\.tsx?:\d+)/;

/** Returns the chain of source locations which led to the current call, up to the test which made it. */
function getOrigin(): string {
    const frames: string[] = [];
    // The first lines are the error message and the wrapper which called this
    for (const line of (new Error().stack ?? "").split("\n").slice(3)) {
        const test = TEST_FRAME.exec(line);
        if (test) return frames.length > 0 ? frames.join(" < ") : test[2];
        const source = SOURCE_FRAME.exec(line);
        if (source) frames.push(source[1]);
    }
    return frames.join(" < ");
}

// The private fields which hold registrations, read to check whether each is still alive
type DispatcherInternals = { callbacks: Map<string, unknown> };
type SettingsStoreInternals = { watchers: Map<string, unknown> };

let registrations: Registration[] = [];
let uninstall: (() => void)[] = [];

/** Wraps `object[method]` to record each registration it makes, until {@link uninstall} runs. */
function track<T extends object, K extends keyof T & string>(
    object: T,
    method: K,
    isRegistered: (handle: string) => boolean,
): void {
    const original = object[method] as (...args: unknown[]) => string;
    object[method] = function (this: unknown, ...args: unknown[]): string {
        const handle = original.apply(this, args);
        registrations.push({
            isAlive: () => isRegistered(handle),
            origin: getOrigin(),
            test: expect.getState().currentTestName ?? "",
        });
        return handle;
    } as T[K];
    uninstall.push(() => (object[method] = original as T[K]));
}

beforeEach(() => {
    // Some tests run without a window at all
    if (typeof window === "undefined") return;

    const dispatcher: MatrixDispatcher | undefined = window.mxDispatcher;
    const callbacks = (dispatcher as unknown as DispatcherInternals | undefined)?.callbacks;
    if (dispatcher && callbacks instanceof Map) {
        track(dispatcher, "register", (id) => callbacks.has(id));
    }

    // The global is declared with the instance type, but holds the class with its static methods
    const settingsStore = window.mxSettingsStore as unknown as typeof SettingsStore | undefined;
    const watchers = (settingsStore as unknown as SettingsStoreInternals | undefined)?.watchers;
    if (settingsStore && watchers instanceof Map) {
        track(settingsStore, "watchSetting", (ref) => watchers.has(ref));
    }
});

afterEach(() => {
    for (const fn of uninstall.reverse()) fn();
    uninstall = [];

    registrations = registrations.filter((r) => r.isAlive());
    const byOrigin = new Map<string, Registration[]>();
    for (const r of registrations) byOrigin.set(r.origin, [...(byOrigin.get(r.origin) ?? []), r]);
    const test = expect.getState().currentTestName ?? "";
    const leaks = [...byOrigin].filter(
        ([, live]) => live.some((r) => r.test === test) && live.some((r) => r.test !== test),
    );
    if (leaks.length === 0) return;

    const details = leaks.map(([origin, live]) => `  ${live.length} registrations from ${origin}`).join("\n");
    throw new Error(
        "Registrations on the dispatcher or settings store are piling up across tests, because the " +
            "objects which made them were never torn down. Call destroy(), dispose() or stop() on what the " +
            `test creates, for example in afterEach:\n${details}`,
    );
});
