/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useSyncExternalStore } from "react";

import { type ViewModel } from "./ViewModel";

export function useViewModel<T>(vm: ViewModel<T>): T {
    return useSyncExternalStore(vm.subscribe, vm.getSnapshot);
}
