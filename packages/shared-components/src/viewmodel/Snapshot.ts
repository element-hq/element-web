/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * This is the output of the viewmodel that the view consumes.
 * Updating snapshot through this object will make react re-render
 * components.
 */
export class Snapshot<T> {
    public constructor(
        private snapshot: T,
        private emit: () => void,
    ) {}

    /**
     * Replace current snapshot with a new snapshot value.
     * @param snapshot New snapshot value
     */
    public set(snapshot: T): void {
        this.snapshot = snapshot;
        this.emit();
    }

    /**
     * Update a part of the current snapshot by merging into the existing snapshot.
     * @param snapshot A subset of the snapshot to merge into the current snapshot.
     */
    public merge(snapshot: Partial<T>): void {
        this.snapshot = { ...this.snapshot, ...snapshot };
        this.emit();
    }

    /**
     * The current value of the snapshot.
     */
    public get current(): T {
        return this.snapshot;
    }
}
