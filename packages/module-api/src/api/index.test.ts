/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "vitest";

import { type Api, isModule } from ".";

const TestModule = {
    default: class TestModule {
        public static moduleApiVersion = "1.0.0";
        public constructor(private readonly api: Api) {}
        public async load(): Promise<void> {}
    },
};

test("isModule correctly identifies valid modules", () => {
    expect(isModule(TestModule)).toBe(true);
});

test("isModule accepts modules implementing the optional lifecycle hooks", () => {
    const LifecycleModule = {
        default: class LifecycleModule {
            public static moduleApiVersion = "1.0.0";
            public constructor(private readonly api: Api) {}
            public async load(): Promise<void> {}
            public async onLoggedIn(): Promise<void> {}
            public async onLoggedOut(): Promise<void> {}
        },
    };
    expect(isModule(LifecycleModule)).toBe(true);
});

test("isModule rejects modules without a load method", () => {
    const InvalidModule = {
        default: class InvalidModule {
            public static moduleApiVersion = "1.0.0";
            public async onLoggedIn(): Promise<void> {}
        },
    };
    expect(isModule(InvalidModule)).toBe(false);
});
