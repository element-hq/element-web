/*
Copyright 2026 Element Creations Ltd.
Copyright 2023 Nordeck IT + Consulting GmbH

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import { matchPattern } from "../src/utils/matchPattern";

describe("matchPattern", () => {
    it.each([
        "*",
        "org.matrix.msc2762.receive.*",
        "org.matrix.msc2762.receive.state_event:*",
        "org.matrix.msc2762.receive.state_event:m.custom*",
        "org.matrix.msc2762.receive.state_event:m.custom#*",
        "org.matrix.msc2762.receive.state_event:m.custom#state_key",
        "org.matrix.msc2762.receive.state_event:m.custom#state_key*",
    ])("matches %s", (pattern) => {
        expect(matchPattern("org.matrix.msc2762.receive.state_event:m.custom#state_key", pattern)).toBe(true);
    });

    it.each([
        "org.matrix.msc2762.receive.state_event:",
        "org.matrix.msc2762.receive.state_event:m.custom",
        "org.matrix.msc2762.receive.state_event:m.custom#other_key",
        "org.matrix.msc2762.receive.*:m.custom#state_key",
        "org.matrix.msc2762.receive.room_event:m.custom",
    ])("does not match %s", (pattern) => {
        expect(matchPattern("org.matrix.msc2762.receive.state_event:m.custom#state_key", pattern)).toBe(false);
    });
});
