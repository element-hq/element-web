/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Utility class for view models to manage subscriptions to their updates
 */
export class ViewModelSubscriptions {
    private listeners = new Set<() => void>();

    /**
     * Subscribe to changes in the view model.
     * @param listener Will be called whenever the snapshot changes.
     * @returns A function to unsubscribe from the view model updates.
     */
    public add = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /**
     * Emit an update to all subscribed listeners.
     */
    public emit = (): void => {
        for (const listener of this.listeners) {
            listener();
        }
    };
}
