/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComponentType } from "react";

/**
 * Options for {@link Api#openDialog}.
 * @public
 */
export interface DialogOptions {
    /**
     * The title of the dialog.
     */
    title: string;
}

/**
 * Handle returned by {@link Api#openDialog}.
 * @public
 */
export type DialogHandle<M> = {
    /**
     * Promise that resolves when the dialog is finished.
     */
    finished: Promise<{ ok: boolean; model: M | null }>;
    /**
     * Method to close the dialog.
     */
    close(): void;
};

/**
 * Props passed to the dialog body component.
 * @public
 */
export type DialogProps<M> = {
    /**
     * Callback to submit the dialog.
     * @param model - The model to submit with the dialog. This is typically the data collected.
     */
    onSubmit(model: M): void;
    /**
     * Cancel the dialog programmatically.
     */
    onCancel(): void;
};

/**
 * Methods to manage dialogs in the application.
 * @public
 */
export interface DialogApiExtension {
    /**
     * Open a dialog with the given options and body component and return a handle to it.
     * @param initialOptions - The initial options for the dialog, such as title and action label.
     * @param dialog - The body component to render in the dialog. This component should accept props of type `P`.
     * @param props - Additional props to pass to the body
     */
    openDialog<M, P extends object>(
        initialOptions: DialogOptions,
        dialog: ComponentType<P & DialogProps<M>>,
        props: P,
    ): DialogHandle<M>;
}
