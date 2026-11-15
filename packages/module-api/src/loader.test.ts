/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test, describe, vi, beforeEach } from "vitest";

import { type Api, ModuleIncompatibleError, ModuleLoader } from ".";

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

    test("should load a module with a union semver range", async () => {
        const TestModule = {
            default: class TestModule {
                public static moduleApiVersion = "^0 || ^1";
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

    describe("lifecycle hooks", () => {
        function makeModule(hooks: { onLoggedIn?: () => Promise<void>; onLoggedOut?: () => Promise<void> }) {
            return {
                default: class TestModule {
                    public static moduleApiVersion = "^1.0.0";
                    public constructor(private readonly api: Api) {}
                    public async load(): Promise<void> {}
                    public onLoggedIn = hooks.onLoggedIn;
                    public onLoggedOut = hooks.onLoggedOut;
                },
            };
        }

        test("should call onLoggedIn and onLoggedOut on modules that implement them", async () => {
            const onLoggedIn = vi.fn().mockResolvedValue(undefined);
            const onLoggedOut = vi.fn().mockResolvedValue(undefined);

            const loader = new ModuleLoader(mockApi);
            await loader.load(makeModule({ onLoggedIn, onLoggedOut }));
            await loader.start();

            await loader.onLoggedIn();
            expect(onLoggedIn).toHaveBeenCalledTimes(1);
            expect(onLoggedOut).not.toHaveBeenCalled();

            await loader.onLoggedOut();
            expect(onLoggedOut).toHaveBeenCalledTimes(1);
        });

        test("should not call hooks before the modules are started", async () => {
            const onLoggedIn = vi.fn().mockResolvedValue(undefined);
            const onLoggedOut = vi.fn().mockResolvedValue(undefined);

            const loader = new ModuleLoader(mockApi);
            await loader.load(makeModule({ onLoggedIn, onLoggedOut }));

            await loader.onLoggedIn();
            await loader.onLoggedOut();
            expect(onLoggedIn).not.toHaveBeenCalled();
            expect(onLoggedOut).not.toHaveBeenCalled();
        });

        test("should call the remaining modules when one fails", async () => {
            const error = new Error("oh no");
            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const failing = vi.fn().mockRejectedValue(error);
            const throwing = vi.fn(() => {
                throw error;
            });
            const working = vi.fn().mockResolvedValue(undefined);

            const loader = new ModuleLoader(mockApi);
            await loader.load(makeModule({ onLoggedOut: failing }));
            await loader.load(makeModule({ onLoggedOut: throwing }));
            await loader.load(makeModule({ onLoggedOut: working }));
            await loader.start();

            await expect(loader.onLoggedOut()).resolves.toBeUndefined();
            expect(working).toHaveBeenCalledTimes(1);
            expect(consoleSpy).toHaveBeenCalledTimes(2);
            expect(consoleSpy).toHaveBeenCalledWith("Module onLoggedOut hook failed", error);
            consoleSpy.mockRestore();
        });
    });
});
