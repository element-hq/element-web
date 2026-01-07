/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ViewModel } from "./ViewModel";

/**
 * A mock view model that returns a static snapshot passed in the constructor, with no updates.
 */
export class MockViewModel<T> implements ViewModel<T> {
    public constructor(private snapshot: T) {}

    public getSnapshot = (): T => {
        return this.snapshot;
    };

    public subscribe(listener: () => void): () => void {
        return () => undefined;
    }
}
