/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * A value that may be a direct value or a Promise resolving to that value.
 * Useful for callback APIs that can operate synchronously or asynchronously.
 * @public
 */
export type MaybePromise<T> = T | PromiseLike<T>;
