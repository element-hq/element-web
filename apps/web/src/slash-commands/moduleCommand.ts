/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ComposerApiSlashCommand, ComposerApiTarget } from "@element-hq/element-web-module-api";

import { Command } from "./command";
import { CommandCategories } from "./interface";
import { success } from "./utils";
import { TimelineRenderingType } from "../contexts/RoomContext";

function toRenderingType(view: ComposerApiTarget["view"]): TimelineRenderingType {
    switch (view) {
        case "room":
            return TimelineRenderingType.Room;
        case "thread":
            return TimelineRenderingType.Thread;
        default:
            throw new Error(`Invalid view '${view}'`);
    }
}

/**
 * Create a {@link Command} from a slash command provided by a module through the composer API.
 * @param opts - The command as provided by the module.
 * @throws If the category or any of the views is invalid.
 */
export function createModuleSlashCommand(opts: ComposerApiSlashCommand): Command {
    const category = opts.category ?? "other";
    if (!Object.hasOwn(CommandCategories, category)) {
        throw new Error(`Invalid category '${category}'`);
    }
    const { run, isEnabled } = opts;
    return new Command({
        command: opts.command,
        aliases: opts.aliases,
        args: opts.args,
        // Modules give us an already translated string.
        description: opts.description as TranslationKey,
        isDescriptionTranslated: true,
        category: CommandCategories[category],
        hideCompletionAfterSpace: opts.hideCompletionAfterSpace,
        renderingTypes: opts.views?.map(toRenderingType),
        isEnabled: isEnabled && ((_cli, roomId) => isEnabled(roomId)),
        // Run inside a promise so that a synchronous throw is reported to the user like a rejection.
        runFn:
            run &&
            ((_cli, roomId, threadId, args) =>
                success(Promise.resolve().then(() => run(args, { roomId, threadId: threadId ?? undefined })))),
    });
}
