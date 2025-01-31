/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { expect, test } from "vitest";

import { Api } from ".";
import { isModule } from "./api.js";

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
