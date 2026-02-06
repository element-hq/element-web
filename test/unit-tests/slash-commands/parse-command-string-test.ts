/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { parseCommandString } from "../../../src/slash-commands/SlashCommands";

describe("parseCommandString", () => {
    it("should be able to split arguments at the first whitespace", () => {
        expect(parseCommandString("/a b")).toEqual({ cmd: "a", args: "b" });
        expect(parseCommandString("/cmd And more stuff")).toEqual({ cmd: "cmd", args: "And more stuff" });
        expect(parseCommandString("/cmd And more stuff")).toEqual({ cmd: "cmd", args: "And more stuff" });
        expect(parseCommandString("/cmd And more\nstuff")).toEqual({ cmd: "cmd", args: "And more\nstuff" });
        //expect(parseCommandString("/cmd \t\n And more stuff")).toEqual({ cmd: "cmd", args: "And more stuff" });
        expect(parseCommandString("/a")).toEqual({ cmd: "a" });
        expect(parseCommandString("/cmd")).toEqual({ cmd: "cmd" });
        expect(parseCommandString("/cmd    ")).toEqual({ cmd: "cmd" });
        //expect(parseCommandString("  /cmd    ")).toEqual({ cmd: "cmd" });
    });
});
