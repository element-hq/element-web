/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ComponentType, SVGAttributes } from "react";

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
}
