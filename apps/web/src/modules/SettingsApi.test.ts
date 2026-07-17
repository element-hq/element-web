/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect, vi } from "vitest";

import SettingsStore from "../settings/SettingsStore";
import { SettingsApi } from "./SettingsApi";

describe("SettingsApi", () => {
    it("should return the value from SettingsStore.getValue", () => {
        const spy = vi.spyOn(SettingsStore, "getValue").mockReturnValue("en" as any);
        const api = new SettingsApi();
        expect(api.getValue("language")).toBe("en");
        expect(spy).toHaveBeenCalledWith("language", undefined, undefined);
    });

    it("should pass roomId and excludeDefault through to SettingsStore.getValue", () => {
        const spy = vi.spyOn(SettingsStore, "getValue").mockReturnValue(null);
        const api = new SettingsApi();
        api.getValue("m.setting", "!room:example.org", true);
        expect(spy).toHaveBeenCalledWith("m.setting", "!room:example.org", true);
    });
});
