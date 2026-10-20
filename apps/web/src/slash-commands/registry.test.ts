/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, it, expect } from "vitest";

import { CommandMap, Commands, registerCommand, registerModuleCommand } from "./registry";
import { type Command } from "./command";

describe("registry", () => {
    it("registers a command under its name and aliases", () => {
        const cmd = { command: "test_cmd", aliases: ["test_alias"] } as Command;
        registerCommand(cmd);
        expect(Commands).toContain(cmd);
        expect(CommandMap.get("test_cmd")).toBe(cmd);
        expect(CommandMap.get("test_alias")).toBe(cmd);
    });

    it("throws without registering anything if a name is already in use", () => {
        registerCommand({ command: "taken", aliases: [] as string[] } as Command);
        const commandCount = Commands.length;
        expect(() => registerCommand({ command: "free", aliases: ["taken"] } as Command)).toThrow(
            'Command "taken" already exists',
        );
        expect(CommandMap.has("free")).toBe(false);
        expect(Commands).toHaveLength(commandCount);
    });

    it("throws when registering a module command before the built-in commands have loaded", () => {
        expect(() => registerModuleCommand({ command: "module_cmd", description: "" })).toThrow(
            "Slash commands have not loaded yet",
        );
    });
});
