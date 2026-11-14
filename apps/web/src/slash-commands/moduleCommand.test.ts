/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi } from "vitest";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { TimelineRenderingType } from "../contexts/RoomContext";
// Load the commands via SlashCommands first, as loading `./command` directly fails on a circular import.
import { CommandCategories } from "./SlashCommands";
import { createModuleSlashCommand } from "./moduleCommand";

describe("createModuleSlashCommand", () => {
    const client = {} as MatrixClient;
    const roomId = "!room:example.org";

    it("maps the module options onto the command", () => {
        const command = createModuleSlashCommand({
            command: "roll",
            aliases: ["dice"],
            args: "<sides>",
            description: "Roll a dice",
            category: "messages",
            hideCompletionAfterSpace: true,
            views: ["thread"],
        });
        expect(command.command).toEqual("roll");
        expect(command.aliases).toEqual(["dice"]);
        expect(command.args).toEqual("<sides>");
        expect(command.getDescription()).toEqual("Roll a dice");
        expect(command.category).toEqual(CommandCategories.messages);
        expect(command.hideCompletionAfterSpace).toBe(true);
        expect(command.renderingTypes).toEqual([TimelineRenderingType.Thread]);
    });

    it("defaults to the 'other' category and to being enabled", () => {
        const command = createModuleSlashCommand({ command: "roll", description: "Roll a dice" });
        expect(command.category).toEqual(CommandCategories.other);
        expect(command.renderingTypes).toBeUndefined();
        expect(command.isEnabled(client, roomId)).toBe(true);
    });

    it("passes the room ID to isEnabled", () => {
        const isEnabled = vi.fn().mockReturnValue(false);
        const command = createModuleSlashCommand({ command: "roll", description: "Roll a dice", isEnabled });
        expect(command.isEnabled(client, roomId)).toBe(false);
        expect(isEnabled).toHaveBeenCalledWith(roomId);
    });

    it("throws for an invalid category", () => {
        expect(() =>
            createModuleSlashCommand({ command: "roll", description: "", category: "bleh" as "other" }),
        ).toThrow("Invalid category 'bleh'");
    });

    it("throws for an invalid view", () => {
        expect(() => createModuleSlashCommand({ command: "roll", description: "", views: ["bleh" as "room"] })).toThrow(
            "Invalid view 'bleh'",
        );
    });

    it("runs the module function and returns its content", async () => {
        const content = { msgtype: "m.text", body: "4" };
        const run = vi.fn().mockResolvedValue(content);
        const command = createModuleSlashCommand({ command: "roll", description: "Roll a dice", run });
        await expect(command.run(client, roomId, "$thread", "6").promise).resolves.toEqual(content);
        expect(run).toHaveBeenCalledWith("6", { roomId, threadId: "$thread" });
    });

    it("omits the thread ID when run in the room timeline", async () => {
        const run = vi.fn();
        const command = createModuleSlashCommand({ command: "roll", description: "Roll a dice", run });
        await expect(command.run(client, roomId, null).promise).resolves.toBeUndefined();
        expect(run).toHaveBeenCalledWith(undefined, { roomId, threadId: undefined });
    });

    it("reports a synchronous throw as a rejected promise", async () => {
        const command = createModuleSlashCommand({
            command: "roll",
            description: "Roll a dice",
            run: () => {
                throw new Error("No dice");
            },
        });
        await expect(command.run(client, roomId, null).promise).rejects.toThrow("No dice");
    });

    it("cannot be run without a run function", () => {
        const command = createModuleSlashCommand({ command: "roll", description: "Roll a dice" });
        expect(command.run(client, roomId, null).error).toBeDefined();
    });
});
