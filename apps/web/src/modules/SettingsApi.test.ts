/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { Level } from "@element-hq/element-web-module-api";

import SettingsStore from "../settings/SettingsStore";
import { SettingsApi } from "./SettingsApi";
import { SettingLevel } from "../settings/SettingLevel";

describe("SettingsApi", () => {
    it("should return the value from SettingsStore.getValue", () => {
        const spy = vi.spyOn(SettingsStore, "getValue").mockReturnValue("en" as any);
        const api = new SettingsApi();
        expect(api.getValue("language").value).toBe("en");
        expect(spy).toHaveBeenCalledWith("language", undefined, undefined);
    });

    it("should pass roomId and excludeDefault through to SettingsStore.getValue", () => {
        const spy = vi.spyOn(SettingsStore, "getValue").mockReturnValue(null);
        const api = new SettingsApi();
        api.getValue("m.setting", "!room:example.org", true);
        expect(spy).toHaveBeenCalledWith("m.setting", "!room:example.org", true);
    });

    it("should update watchable when setting value changes", () => {
        vi.spyOn(SettingsStore, "getValue").mockReturnValue("en");

        const api = new SettingsApi();
        const watchable = api.getValue("language");

        // Subscribe to the watchable
        const fn = vi.fn();
        watchable.watch(fn);

        // Setting value is initially "en"
        expect(watchable.value).toBe("en");

        // Let's change the setting value
        vi.spyOn(SettingsStore, "getValue").mockReturnValue("fr");
        SettingsStore.setValue("language", null, SettingLevel.DEVICE, "fr");

        // Watchable should have updated
        expect(fn).toHaveBeenCalled();
        expect(watchable.value).toBe("fr");
    });

    it("should set setting value by calling SettingStore.setValue", () => {
        const spy = vi.spyOn(SettingsStore, "setValue");
        const api = new SettingsApi();
        api.setValue("language", null, "DEVICE" as Level, "en");
        expect(spy).toHaveBeenCalled();
    });
});
