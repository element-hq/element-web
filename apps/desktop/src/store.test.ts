/*
Copyright 2026 hayaksi1

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, describe, it, beforeAll, beforeEach, vi } from "vitest";

import Store from "./store.js";

/** Options the Store passed to the ElectronStore constructor, captured by the mock below. */
let storeOptions: { schema: Record<string, Record<string, unknown>> } | undefined;
/** In-memory stand-in for the on-disk electron-config.json, so the tests touch no real config. */
const backing = new Map<string, unknown>();

vi.mock("electron-store", () => ({
    default: class MockElectronStore {
        public constructor(options: { schema: Record<string, Record<string, unknown>> }) {
            storeOptions = options;
        }
        public get(key: string, defaultValue?: unknown): unknown {
            return backing.has(key) ? backing.get(key) : defaultValue;
        }
        public set(key: string, value: unknown): void {
            backing.set(key, value);
        }
    },
}));

vi.mock("electron", () => ({
    app: {
        getPath: vi.fn(() => "/tmp/element-store-test"),
        commandLine: { appendSwitch: vi.fn() },
    },
    safeStorage: {},
    dialog: {},
}));

vi.mock("./language-helper.js");
vi.mock("./config.js");

describe("Store", () => {
    let store: Store;

    beforeAll(() => {
        store = Store.initialize(undefined);
    });

    beforeEach(() => {
        backing.clear();
    });

    describe("shouldWarnBeforeExit", () => {
        it("should default to not warning on macOS, where ⌘Q quits immediately by convention", () => {
            vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
            expect(store.shouldWarnBeforeExit()).toBe(false);
        });

        it.each(["win32", "linux"] as const)("should default to warning on %s", (platform) => {
            vi.spyOn(process, "platform", "get").mockReturnValue(platform);
            expect(store.shouldWarnBeforeExit()).toBe(true);
        });

        it("should honour an explicit opt-in over the macOS default", () => {
            vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
            store.set("warnBeforeExit", true);
            expect(store.shouldWarnBeforeExit()).toBe(true);
        });

        it.each(["win32", "linux"] as const)("should honour an explicit opt-out on %s", (platform) => {
            vi.spyOn(process, "platform", "get").mockReturnValue(platform);
            store.set("warnBeforeExit", false);
            expect(store.shouldWarnBeforeExit()).toBe(false);
        });

        it("should not declare a schema default, which conf would write to disk on first run", () => {
            // A schema default is persisted to electron-config.json when the store is first created,
            // which would make the platform default indistinguishable from a user's explicit choice.
            expect(storeOptions!.schema.warnBeforeExit).not.toHaveProperty("default");
            // Sanity check that the assertion above can fail: other keys do declare defaults.
            expect(storeOptions!.schema.minimizeToTray).toHaveProperty("default", true);
        });
    });
});
