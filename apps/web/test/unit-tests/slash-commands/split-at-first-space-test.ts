/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { splitAtFirstSpace } from "../../../src/slash-commands/SlashCommands";

describe("splitAtFirstSpace", () => {
    it("should be able to split arguments at the first whitespace", () => {
        expect(splitAtFirstSpace("a b")).toEqual(["a", "b"]);
        expect(splitAtFirstSpace("arg1 Followed by more stuff")).toEqual(["arg1", "Followed by more stuff"]);
        expect(splitAtFirstSpace("arg1 Followed by more\nstuff")).toEqual(["arg1", "Followed by more\nstuff"]);
        expect(splitAtFirstSpace("  arg1 Followed by more stuff  ")).toEqual(["arg1", "Followed by more stuff"]);
        expect(splitAtFirstSpace("arg1 \t\n Followed by more stuff")).toEqual(["arg1", "Followed by more stuff"]);
        expect(splitAtFirstSpace("a")).toEqual(["a"]);
        expect(splitAtFirstSpace("arg1")).toEqual(["arg1"]);
        expect(splitAtFirstSpace("arg1    ")).toEqual(["arg1"]);
        expect(splitAtFirstSpace("  arg1    ")).toEqual(["arg1"]);
    });
});
