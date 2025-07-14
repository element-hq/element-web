/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Utility class for view models to manage suscriptions to their updates
 */
export class ViewModelSubscriptions {
    private listeners = new Set<() => void>();

    /**
     * @param updateSubscription A function called whenever a listener is added or removed.
     */
    public constructor(
        private subscribeCallback: () => void,
        private unsubscribeCallback: () => void,
    ) {}

    /**
     * Subscribe to changes in the view model.
     * @param listener Will be called whenever the snapshot changes.
     * @returns A function to unsubscribe from the view model updates.
     */
    public add = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        if (this.listeners.size === 1) {
            this.subscribeCallback();
        }

        return () => {
            this.listeners.delete(listener);
            if (this.listeners.size === 0) {
                this.unsubscribeCallback();
            }
        };
    };

    /**
     * Emit an update to all subscribed listeners.
     */
    public emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    /**
     * Get the number of listeners currently subscribed to updates.
     * @returns The number of listeners.
     */
    public listenerCount(): number {
        return this.listeners.size;
    }
}
