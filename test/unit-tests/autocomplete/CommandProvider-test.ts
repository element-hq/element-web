/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import CommandProvider from "../../../src/autocomplete/CommandProvider";
import { stubClient } from "../../test-utils";
import { Command } from "../../../src/slash-commands/command";
import { CommandCategories } from "../../../src/slash-commands/interface";
import { _td } from "../../../src/languageHandler";
import * as SlashCommands from "../../../src/SlashCommands";

describe("CommandProvider", () => {
    let room: Room;

    beforeEach(() => {
        stubClient();
        room = {
            roomId: "!room:server",
        } as Room;
    });

    it("should filter out disabled commands when arguments are provided", async () => {
        // Create a disabled command
        const disabledCommand = new Command({
            command: "disabled",
            args: "<arg>",
            description: _td("slash_command|spoiler"),
            runFn: jest.fn(),
            category: CommandCategories.messages,
            isEnabled: () => false,
        });

        // Create an enabled command
        const enabledCommand = new Command({
            command: "enabled",
            args: "<arg>",
            description: _td("slash_command|shrug"),
            runFn: jest.fn(),
            category: CommandCategories.messages,
            isEnabled: () => true,
        });

        // Mock the Commands array and CommandMap
        Object.defineProperty(SlashCommands, "Commands", {
            value: [disabledCommand, enabledCommand],
            configurable: true,
        });

        const mockCommandMap = new Map<string, Command>();
        mockCommandMap.set("disabled", disabledCommand);
        mockCommandMap.set("enabled", enabledCommand);

        Object.defineProperty(SlashCommands, "CommandMap", {
            value: mockCommandMap,
            configurable: true,
        });

        const provider = new CommandProvider(room);

        // When we search for a disabled command with arguments
        const completions = await provider.getCompletions("/disabled test", {
            beginning: true,
            start: 0,
            end: 14,
        });

        // Then we should get no completions because the command is disabled
        expect(completions).toEqual([]);

        // When we search for an enabled command with arguments
        const enabledCompletions = await provider.getCompletions("/enabled test", {
            beginning: true,
            start: 0,
            end: 13,
        });

        // Then we should get the completion because the command is enabled
        // The completion preserves the arguments when the command matches
        expect(enabledCompletions.length).toBe(1);
        expect(enabledCompletions[0].completion).toBe("/enabled test");
    });
});
