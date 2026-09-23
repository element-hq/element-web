/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "test-utils-rtl";
import { stubClient } from "test-utils";
import { vi, describe, it, expect, beforeEach } from "vitest";

import SlashCommandHelpDialog from "./SlashCommandHelpDialog";
import { Command } from "../../../slash-commands/command";
import { CommandCategories } from "../../../slash-commands/interface";
import { _t, _td } from "../../../languageHandler";
import * as SlashCommands from "../../../slash-commands/SlashCommands";

describe("SlashCommandHelpDialog", () => {
    const roomId = "!room:server";

    beforeEach(() => {
        stubClient();
    });

    it("should filter out disabled commands", () => {
        // Create commands with some enabled and some disabled
        const enabledCommand = new Command({
            command: "enabled",
            args: "<arg>",
            description: _td("slash_command|spoiler"),
            runFn: vi.fn(),
            category: CommandCategories.messages,
            isEnabled: () => true,
        });

        const disabledCommand = new Command({
            command: "disabled",
            args: "<arg>",
            description: _td("slash_command|shrug"),
            runFn: vi.fn(),
            category: CommandCategories.messages,
            isEnabled: () => false,
        });

        // Mock the Commands array by replacing the property
        Object.defineProperty(SlashCommands, "Commands", {
            value: [enabledCommand, disabledCommand],
            configurable: true,
        });

        const onFinished = vi.fn();
        render(<SlashCommandHelpDialog roomId={roomId} onFinished={onFinished} />);

        // The enabled command should be visible
        expect(screen.getByText("/enabled")).toBeInTheDocument();

        // The disabled command should not be visible
        expect(screen.queryByText("/disabled")).not.toBeInTheDocument();
    });

    it("should group commands by category", () => {
        const messageCommand = new Command({
            command: "msg",
            args: "",
            description: _td("slash_command|plain"),
            runFn: vi.fn(),
            category: CommandCategories.messages,
        });

        const adminCommand = new Command({
            command: "admin",
            args: "",
            description: _td("slash_command|upgraderoom"),
            runFn: vi.fn(),
            category: CommandCategories.admin,
        });

        Object.defineProperty(SlashCommands, "Commands", {
            value: [messageCommand, adminCommand],
            configurable: true,
        });

        const onFinished = vi.fn();
        render(<SlashCommandHelpDialog roomId={roomId} onFinished={onFinished} />);

        // Both category headers should be present
        expect(screen.getByText(_t(CommandCategories.messages))).toBeInTheDocument();
        expect(screen.getByText(_t(CommandCategories.admin))).toBeInTheDocument();
    });
});
