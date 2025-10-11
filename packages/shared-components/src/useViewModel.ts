/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useSyncExternalStore } from "react";

import { type ViewModel } from "./ViewModel";

/**
 * A small wrapper around useSyncExternalStore to use a view model in a shared component view
 * @param vm The view model to use
 * @returns The current snapshot
 */
export function useViewModel<T>(vm: ViewModel<T>): T {
    // We need to pass the same getSnapshot function as getServerSnapshot as this
    // is used when making the HTML chat export.
    return useSyncExternalStore(vm.subscribe, vm.getSnapshot, vm.getSnapshot);
}
