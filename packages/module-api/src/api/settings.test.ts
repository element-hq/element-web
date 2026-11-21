/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expectTypeOf, it } from "vitest";

import { Level, type SettingName, type SettingsApi, type SettingValue } from "./settings";
import type { Watchable } from "./watchable";

// Declare a module setting the way a module would.
declare module "./settings" {
    interface ModuleSettingValues {
        "module.test.enabled": boolean;
    }
}

describe("SettingsApi types", () => {
    it("types the values of settings declared in ModuleSettingValues", () => {
        expectTypeOf<SettingValue<"module.test.enabled">>().toEqualTypeOf<boolean>();
        const api = {} as SettingsApi;
        expectTypeOf<ReturnType<typeof api.getValueWatchable<"module.test.enabled">>>().toEqualTypeOf<
            Watchable<boolean>
        >();
    });

    it("uses any for app settings", () => {
        expectTypeOf<SettingValue<"language">>().toBeAny();
    });

    it("rejects module settings not declared in ModuleSettingValues", () => {
        expectTypeOf<SettingName<"module.test.typo">>().toBeNever();
        expectTypeOf<SettingName<"module.test.enabled">>().toEqualTypeOf<"module.test.enabled">();
        expectTypeOf<SettingName<"language">>().toEqualTypeOf<"language">();
        // A name only known at runtime is not treated as a module setting name.
        expectTypeOf<SettingName<string>>().toEqualTypeOf<string>();

        // Never called: only checks which calls compile.
        const calls = (api: SettingsApi): void => {
            // @ts-expect-error - "module.test.typo" is not declared
            api.getValueWatchable("module.test.typo");
            // @ts-expect-error - "module.test.typo" is not declared
            void api.setValue("module.test.typo", null, Level.DEVICE, true);
            api.getValueWatchable("module.test.enabled");
            api.getValueWatchable("language");
        };
        expectTypeOf(calls).toBeFunction();
    });

    it("only accepts values of the declared type for declared settings", () => {
        const api = {} as SettingsApi;
        expectTypeOf<Parameters<typeof api.setValue<"module.test.enabled">>[3]>().toEqualTypeOf<boolean>();
        expectTypeOf<Parameters<typeof api.setValue<"language">>[3]>().toBeAny();
    });

    it("requires every declared setting to be registered with a matching default", () => {
        const api = {} as SettingsApi;
        expectTypeOf(api.registerSettings).toBeCallableWith({
            "module.test.enabled": { default: false, supportedLevels: [Level.DEVICE] },
        });
        expectTypeOf(api.registerSettings).toBeCallableWith({
            // @ts-expect-error - the default must be a boolean
            "module.test.enabled": { default: "no", supportedLevels: [Level.DEVICE] },
        });
    });
});
