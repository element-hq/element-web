/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import DefaultSettingsHandler from "./DefaultSettingsHandler";

describe("DefaultSettingsHandler", () => {
    it("should return defaults added with addDefault", () => {
        const handler = new DefaultSettingsHandler({ existing: 1 }, {});
        expect(handler.getValue("added", "")).toBeUndefined();

        handler.addDefault("added", true);

        expect(handler.getValue("added", "")).toBe(true);
        expect(handler.getValue("existing", "")).toBe(1);
    });
});
