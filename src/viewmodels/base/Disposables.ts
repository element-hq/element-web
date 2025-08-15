/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { EventEmitter } from "events";

/**
 * Something that needs to be eventually disposed. This can be:
 * - A function that does the disposing
 * - An object containing a dispose method which does the disposing
 */
export type DisposableItem = { dispose: () => void } | (() => void);

/**
 * This class provides a way for the view-model to track any resource
 * that it needs to eventually relinquish.
 */
export class Disposables {
    private readonly disposables: DisposableItem[] = [];
    private _isDisposed: boolean = false;

    /**
     * Relinquish all tracked disposable values
     */
    public dispose(): void {
        if (this.isDisposed) return;
        this._isDisposed = true;
        for (const disposable of this.disposables) {
            if (typeof disposable === "function") {
                disposable();
            } else {
                disposable.dispose();
            }
        }
    }

    /**
     * Track a value that needs to be eventually relinquished
     */
    public track<T extends DisposableItem>(disposable: T): T {
        this.throwIfDisposed();
        this.disposables.push(disposable);
        return disposable;
    }

    /**
     * Add an event listener that will be removed on dispose
     */
    public trackListener(emitter: EventEmitter, event: string, callback: (...args: unknown[]) => void): void {
        this.throwIfDisposed();
        emitter.on(event, callback);
        this.track(() => {
            emitter.off(event, callback);
        });
    }

    private throwIfDisposed(): void {
        if (this.isDisposed) throw new Error("Disposable is already disposed");
    }

    /**
     * Whether this disposable has been disposed
     */
    public get isDisposed(): boolean {
        return this._isDisposed;
    }
}
