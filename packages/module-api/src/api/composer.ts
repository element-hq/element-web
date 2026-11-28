/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComponentType, type SVGAttributes } from "react";

/**
 * An option presented to the user for uploading a file.
 * @alpha Unlikely to change
 */
export type ComposerApiFileUploadOption = {
    /**
     * An unique string to refer to the type of upload
     * @example org.example.my_uploader
     */
    type: string;
    /**
     * Human-readable string used in labelling for the option.
     */
    label: string;
    /**
     * An icon to attach to the option. If omitted, no icon is shown.
     */
    icon?: ComponentType<SVGAttributes<SVGElement>>;
    /**
     * Function called when the option is selected.
     * @param roomId - The room ID of the room in focus.
     * @param relation - Whether or not a thread and/or reply is in focus.
     * @returns
     */
    onSelected: (
        roomId?: string,
        view?: ComposerApiTarget,
        relation?: {
            inReplyToEventId?: string;
            relType?: string;
        },
    ) => Promise<void> | void;
};

/**
 * When handling composer interactions, this represents the target composer.
 * @alpha Likely to change. This is intentionally left as an object so it may be extended later.
 */
export type ComposerApiTarget = { view: "room" } | { view: "thread" };

/**
 * The category a slash command is listed under in the `/help` dialog.
 *
 * The category also affects behaviour: only commands in the `"messages"` and `"effects"` categories may
 * send a message into the room, and only `"messages"` commands mark the user as typing.
 * @alpha Likely to change
 */
export type ComposerApiSlashCommandCategory = "messages" | "actions" | "admin" | "advanced" | "effects" | "other";

/**
 * Message content returned by a slash command, to be sent into the room.
 * @alpha Likely to change
 */
export type ComposerApiSlashCommandContent = {
    /**
     * The `msgtype` of the message, e.g. `m.text`.
     */
    msgtype: string;
    /**
     * The plain text body of the message.
     */
    body: string;
    [key: string]: unknown;
};

/**
 * Information about where a slash command was run.
 * @alpha Likely to change. This is intentionally left as an object so it may be extended later.
 */
export type ComposerApiSlashCommandContext = {
    /**
     * The room ID of the room the command was run in.
     */
    roomId: string;
    /**
     * The thread ID, if the command was run in a thread composer.
     */
    threadId?: string;
};

/**
 * A slash command that the user can run from the message composer, e.g. `/mycommand`.
 * @alpha Likely to change
 */
export type ComposerApiSlashCommand = {
    /**
     * The name of the command, without the leading `/`.
     * @example mycommand
     */
    command: string;
    /**
     * Alternative names for the command, without the leading `/`.
     */
    aliases?: string[];
    /**
     * Human-readable description of the arguments the command takes, shown in autocomplete and `/help`.
     * @example <message>
     */
    args?: string;
    /**
     * Human-readable string describing the command, shown in autocomplete and `/help`.
     */
    description: string;
    /**
     * The category to list the command under. Defaults to `"other"`.
     */
    category?: ComposerApiSlashCommandCategory;
    /**
     * Whether to hide the autocomplete suggestion once the user has typed a space after the command.
     * Defaults to `false`.
     */
    hideCompletionAfterSpace?: boolean;
    /**
     * The composers the command may be run in. If omitted, the command may be run in any composer.
     */
    views?: ComposerApiTarget["view"][];
    /**
     * Determines whether the command is available. Disabled commands are hidden from autocomplete
     * and are not run. If omitted, the command is always enabled.
     * @param roomId - The room ID of the room in focus, if any.
     */
    isEnabled?: (roomId: string | null) => boolean;
    /**
     * Function called when the user runs the command.
     * If omitted, the command is listed in autocomplete but cannot be run.
     *
     * Throw (or reject) with an `Error` to show its message to the user.
     * @param args - Everything the user typed after the command name, if anything.
     * @param context - Where the command was run.
     * @returns Optionally, message content to send into the room. Content is only sent for commands
     *          in the `"messages"` or `"effects"` category.
     */
    run?: (
        args: string | undefined,
        context: ComposerApiSlashCommandContext,
    ) => Promise<ComposerApiSlashCommandContent | void> | ComposerApiSlashCommandContent | void;
};

/**
 * API to interact with the message composer.
 * @alpha Likely to change
 */
export interface ComposerApi {
    /**
     * Add a new file upload option for the user.
     * @throws If another option is already using the same `type`.
     * @alpha Likely to change
     */
    addFileUploadOption(option: ComposerApiFileUploadOption): void;
    /**
     * Open the file upload confirmation dialog. This may be used in conjunction
     * with `addFileUploadOption` to support an alternative file upload kind.
     * @param files - The files to prompt for
     * @param view - The target view to send the file into. Defaults to `{ view: "room" }`
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    openFileUploadConfirmation(files: File[], view: ComposerApiTarget): void;
    /**
     * Insert plaintext into the current composer.
     * @param plaintext - The plain text to insert
     * @param view - The target view to insert text into. Defaults to `{ view: "room" }`
     * @returns Returns immediately, does not await action.
     * @alpha Likely to change
     */
    insertPlaintextIntoComposer(plaintext: string, view: ComposerApiTarget): void;
    /**
     * Register a new slash command for the user to run from the composer.
     * @param command - The command to register.
     * @throws If the command name or any of its aliases is already in use.
     * @alpha Likely to change
     */
    registerSlashCommand(command: ComposerApiSlashCommand): void;
}
