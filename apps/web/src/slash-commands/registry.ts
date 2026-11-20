/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// This file deliberately has no runtime imports. The module API uses it to register commands, and
// importing the commands themselves from there changes the order the app's files load in, which
// breaks circular imports elsewhere.
import type { ComposerApiSlashCommand } from "@element-hq/element-web-module-api";
import type { Command } from "./command";

/**
 * All available commands, both built-in and those provided by modules.
 */
export const Commands: Command[] = [];

/**
 * Map from command names and aliases to the {@link Command} objects.
 */
export const CommandMap = new Map<string, Command>();

let moduleCommandFactory: ((opts: ComposerApiSlashCommand) => Command) | undefined;

/**
 * Add a command to the list of available commands.
 * @param cmd - The command to add.
 * @throws If the command name or any of its aliases is already in use.
 */
export function registerCommand(cmd: Command): void {
    const names = [cmd.command, ...cmd.aliases];
    const existing = names.find((name) => CommandMap.has(name));
    if (existing) {
        throw new Error(`Command "${existing}" already exists`);
    }
    Commands.push(cmd);
    names.forEach((name) => CommandMap.set(name, cmd));
}

/**
 * Set the function used to turn a module's slash command into a {@link Command}.
 * @param factory - The function to use.
 */
export function setModuleCommandFactory(factory: (opts: ComposerApiSlashCommand) => Command): void {
    moduleCommandFactory = factory;
}

/**
 * Add a slash command provided by a module to the list of available commands.
 * @param opts - The command as provided by the module.
 * @throws If the built-in commands have not loaded yet, if the command is invalid, or if the command
 *         name or any of its aliases is already in use.
 */
export function registerModuleCommand(opts: ComposerApiSlashCommand): void {
    if (!moduleCommandFactory) {
        throw new Error("Slash commands have not loaded yet");
    }
    registerCommand(moduleCommandFactory(opts));
}
