/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";
import { type Api } from "@element-hq/element-web-module-api";

import RestrictedGuestsModule from "./index";

const makeApi = (config: unknown): Api => {
    return {
        config: {
            get: vi.fn().mockReturnValue(config),
        },
        i18n: {
            register: vi.fn(),
        },
    } as unknown as Api;
};

describe("RestrictedGuestsModule", () => {
    describe("load", () => {
        it("should do nothing if no config present", async () => {
            const api = makeApi(null);

            const module = new RestrictedGuestsModule(api);
            await module.load();

            expect(api.i18n.register).not.toHaveBeenCalled();
        });
    });
});
