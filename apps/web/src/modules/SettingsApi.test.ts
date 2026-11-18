/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, describe, it, expect, vi } from "vitest";
import { Level } from "@element-hq/element-web-module-api";

import SettingsStore from "../settings/SettingsStore";
import { SettingsApi } from "./SettingsApi";
import { SettingLevel } from "../settings/SettingLevel";

describe("SettingsApi", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        // Device-level settings are saved in localStorage, which reset() doesn't clear.
        localStorage.clear();
        SettingsStore.reset();
    });

    it("should return the value from SettingsStore.getValue", () => {
        const spy = vi.spyOn(SettingsStore, "getValue").mockReturnValue("en" as any);
        const api = new SettingsApi();
        expect(api.getValue("language").value).toBe("en");
        expect(spy).toHaveBeenCalledWith("language", null, false);
    });

    it("should pass roomId and excludeDefault through to SettingsStore.getValue", () => {
        const spy = vi.spyOn(SettingsStore, "getValue").mockReturnValue(null);
        const api = new SettingsApi();
        api.getValue("m.setting", "!room:example.org", true);
        expect(spy).toHaveBeenCalledWith("m.setting", "!room:example.org", true);
    });

    it("should update watchable when setting value changes", async () => {
        const api = new SettingsApi();
        const watchable = api.getValue("language");
        const fn = vi.fn();
        watchable.watch(fn);

        await SettingsStore.setValue("language", null, SettingLevel.DEVICE, "fr");

        expect(fn).toHaveBeenCalled();
        expect(watchable.value).toBe("fr");
    });

    it("should keep the room-scoped value of an app setting when the setting changes", async () => {
        // ircDisplayNameWidth prefers a per-room value over the device value.
        await SettingsStore.setValue("ircDisplayNameWidth", "!roomA", SettingLevel.ROOM_DEVICE, 100);

        const api = new SettingsApi();
        const watchable = api.getValue("ircDisplayNameWidth", "!roomA");
        const fn = vi.fn();
        watchable.watch(fn);
        expect(watchable.value).toBe(100);

        // A change in another room doesn't notify this watchable
        await SettingsStore.setValue("ircDisplayNameWidth", "!roomB", SettingLevel.ROOM_DEVICE, 120);
        expect(fn).not.toHaveBeenCalled();

        // A change that applies to every room is re-read for this room
        await SettingsStore.setValue("ircDisplayNameWidth", null, SettingLevel.DEVICE, 140);
        expect(watchable.value).toBe(100);
    });

    it("should keep excluding the default when the setting changes", async () => {
        const api = new SettingsApi();
        api.registerSettings({ "module.test.excludeDefault": { default: true, supportedLevels: [Level.DEVICE] } });
        const watchable = api.getValue("module.test.excludeDefault", null, true);
        watchable.watch(vi.fn());
        expect(watchable.value).toBeNull();

        await api.setValue("module.test.excludeDefault", null, Level.DEVICE, false);
        expect(watchable.value).toBe(false);

        await api.setValue("module.test.excludeDefault", null, Level.DEVICE, null);
        expect(watchable.value).toBeNull();
    });

    it("should pick up changes made before the watchable is watched", async () => {
        const api = new SettingsApi();
        api.registerSettings({ "module.test.stale": { default: false, supportedLevels: [Level.DEVICE] } });
        const watchable = api.getValue("module.test.stale");
        expect(watchable.value).toBe(false);

        await api.setValue("module.test.stale", null, Level.DEVICE, true);
        watchable.watch(vi.fn());

        expect(watchable.value).toBe(true);
    });

    it("should set setting value by calling SettingStore.setValue", async () => {
        const spy = vi.spyOn(SettingsStore, "setValue").mockResolvedValue();
        const api = new SettingsApi();
        await api.setValue("language", null, Level.DEVICE, "en");
        expect(spy).toHaveBeenCalledWith("language", null, SettingLevel.DEVICE, "en");
    });

    it("should register module settings so they can be read and written", async () => {
        const api = new SettingsApi();
        api.registerSettings({ "module.test.enabled": { default: false, supportedLevels: [Level.DEVICE] } });
        expect(api.getValue("module.test.enabled").value).toBe(false);

        await api.setValue("module.test.enabled", null, Level.DEVICE, true);
        expect(api.getValue("module.test.enabled").value).toBe(true);
    });
});
