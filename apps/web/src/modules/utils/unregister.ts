/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Unregister } from "@element-hq/element-web-module-api";

/**
 * Creates the {@link Unregister} returned by a module API registration.
 * Only the first call runs `remove`, so a module calling it again cannot remove
 * a later registration.
 *
 * @param remove - removes the registration.
 */
export function createUnregister(remove: () => void): Unregister {
    let unregistered = false;
    return () => {
        if (unregistered) return;
        unregistered = true;
        remove();
    };
}

/**
 * Removes the first occurrence of `item` from `array`, if it is present.
 *
 * @param array - the array to remove the item from.
 * @param item - the item to remove.
 */
export function removeFromArray<T>(array: T[], item: T): void {
    const index = array.indexOf(item);
    if (index !== -1) array.splice(index, 1);
}
