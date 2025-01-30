/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";

import { Api, ModuleIncompatibleError, ModuleLoader } from ".";

describe("ModuleIncompatibleError", () => {
    test("should extend Error", () => {
        expect(new ModuleIncompatibleError("1.0.0")).toBeInstanceOf(Error);
    });
});

describe("ModuleLoader", () => {
    const mockApi = {} as Api;

    beforeEach(() => {
        vi.stubGlobal("__VERSION__", "1.0.1");
    });

    test("should load a module", async () => {
        const TestModule = {
            default: class TestModule {
                public static moduleApiVersion = "^1.0.0";
                public constructor(private readonly api: Api) {}
                public async load(): Promise<void> {}
            },
        };

        const spy = vi.spyOn(TestModule.default.prototype, "load");

        const loader = new ModuleLoader(mockApi);
        await loader.load(TestModule);
        await loader.start();
        expect(spy).toHaveBeenCalledWith();
    });

    test("should fail to load an incompatible module", async () => {
        const TestModule = {
            default: class TestModule {
                public static moduleApiVersion = "^2";
                public constructor(private readonly api: Api) {}
                public async load(): Promise<void> {}
            },
        };

        const spy = vi.spyOn(TestModule.default.prototype, "load");

        const loader = new ModuleLoader(mockApi);
        await expect(loader.load(TestModule)).rejects.toThrowError(ModuleIncompatibleError);
        await loader.start();
        expect(spy).not.toHaveBeenCalledWith();
    });
});
