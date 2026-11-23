/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { toSquirrelVersion } from "./squirrel-version.ts";

describe("toSquirrelVersion", () => {
    it.each(["1.12.32", "1.12.32-rc.1", "0.0.1-nightly.2026111301"])("leaves semver version %s unchanged", (v) => {
        expect(toSquirrelVersion(v)).toBe(v);
    });

    it("converts a Nightly version into a semver pre-release", () => {
        expect(toSquirrelVersion("2026111301")).toBe("0.0.1-nightly.2026111301");
    });
});
