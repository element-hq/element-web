/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { arrayDiff, arrayIntersection } from "./arrays";

export function iterableIntersection<T>(a: Iterable<T>, b: Iterable<T>): Iterable<T> {
    return arrayIntersection(Array.from(a), Array.from(b));
}

export function iterableDiff<T>(a: Iterable<T>, b: Iterable<T>): { added: Iterable<T>; removed: Iterable<T> } {
    return arrayDiff(Array.from(a), Array.from(b));
}
