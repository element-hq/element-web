/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * A utility to ensure that a function is only called once triggered with
 * a mark applied. Multiple marks can be applied to the function, however
 * the function will only be called once upon trigger().
 *
 * The function starts unmarked.
 */
export class MarkedExecution {
    private marked = false;

    /**
     * Creates a MarkedExecution for the provided function.
     * @param {Function} fn The function to be called upon trigger if marked.
     * @param {Function} onMarkCallback A function that is called when a new mark is made. Not
     * called if a mark is already flagged.
     */
    public constructor(
        private fn: () => void,
        private onMarkCallback?: () => void,
    ) {}

    /**
     * Resets the mark without calling the function.
     */
    public reset(): void {
        this.marked = false;
    }

    /**
     * Marks the function to be called upon trigger().
     */
    public mark(): void {
        if (!this.marked) this.onMarkCallback?.();
        this.marked = true;
    }

    /**
     * If marked, the function will be called, otherwise this does nothing.
     */
    public trigger(): void {
        if (!this.marked) return;
        this.reset(); // reset first just in case the fn() causes a trigger()
        this.fn();
    }
}
