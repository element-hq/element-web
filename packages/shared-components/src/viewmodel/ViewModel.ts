/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * The interface for a generic View Model passed to the shared components.
 * The snapshot is of type T which is a type specifying a snapshot for the view in question.
 */
export interface ViewModel<T> {
    /**
     * The current snapshot of the view model.
     */
    getSnapshot: () => T;

    /**
     * Subscribes to changes in the view model.
     * The listener will be called whenever the snapshot changes.
     */
    subscribe: (listener: () => void) => () => void;
}
