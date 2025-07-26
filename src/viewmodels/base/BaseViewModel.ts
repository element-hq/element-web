/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ViewModelNew } from "../../shared-components/ViewModel";

export abstract class BaseViewModel<P> implements ViewModelNew {
    /**
     * We are relying on {@link https://react.dev/reference/react/useSyncExternalStore|useSyncExternalStore}
     * to keep the react component in sync with view model.
     * We only use this snapshot as way of convincing react that it should do a re-render when {@link emit} is called.
     */
    private snapshot: unknown = {};
    private callbacks: Set<() => void> = new Set();

    public constructor(protected props: P) {}

    public getSnapshot(): unknown {
        return this.snapshot;
    }

    public subscribe(callback: () => void): () => void {
        this.callbacks.add(callback);
        return () => {
            this.callbacks.delete(callback);
        };
    }

    /**
     * Re-render any subscribed components
     */
    protected emit(): void {
        /**
         * When we invoke the callbacks, react will check if the result of getSnapshot()
         * matches the previously known snapshot value via Object.is().
         * Since the intention of calling this method is to make the UI re-render, we want
         * that comparison to fail.
         * We can do that by assigning a new empty object to snapshot.
         */
        this.snapshot = {};
        for (const callback of this.callbacks) {
            callback();
        }
    }
}
