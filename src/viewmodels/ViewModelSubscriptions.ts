/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export class ViewModelSubscriptions {
    private listeners = new Set<() => void>();

    public constructor(private updateSubscription: () => void) {}

    public subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        this.updateSubscription();

        return () => {
            this.listeners.delete(listener);
            this.updateSubscription();
        };
    };

    public emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }
}
