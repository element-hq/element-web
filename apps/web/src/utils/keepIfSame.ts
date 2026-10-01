/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { isEqual } from "lodash";

/**
 * Returns the current value if it is deeply equal to the next value, otherwise returns the next value.
 * This is useful to prevent unnecessary re-renders in React components when the value has not changed.
 * @param current The current value
 * @param next The next value
 * @returns The current value if it is deeply equal to the next value, otherwise the next value
 */
export function keepIfSame<T>(current: T, next: T): T {
    if (isEqual(current, next)) return current;
    return next;
}
