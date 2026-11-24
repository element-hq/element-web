/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { buildConfigJson } from "./config_json.js";
import { CONFIG_JSON } from "../index.js";

const HS_URL = "http://localhost:8008";

describe("buildConfigJson", () => {
    it("should use the default setting_defaults", () => {
        const json = buildConfigJson(HS_URL);
        expect(json.setting_defaults).toEqual(CONFIG_JSON.setting_defaults);
    });

    it("should merge setting_defaults from the additional config over the defaults", () => {
        const json = buildConfigJson(HS_URL, {
            setting_defaults: { language: "de", userTimezone: "UTC" },
        });
        expect(json.setting_defaults).toEqual({ ...CONFIG_JSON.setting_defaults, language: "de", userTimezone: "UTC" });
    });

    it("should point the client at the given homeserver", () => {
        const json = buildConfigJson(HS_URL);
        expect(json.default_server_config).toEqual({ "m.homeserver": { base_url: HS_URL } });
    });
});
