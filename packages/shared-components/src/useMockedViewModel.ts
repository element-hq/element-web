/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { useMemo } from "react";

import { MockViewModel, type ViewModel } from "./viewmodel";

/**
 * Hook helper to return a mocked view model created with the given snapshot and actions.
 * This is useful for testing components in isolation with a mocked view model and allows to use primitive types in stories.
 *
 * @param snapshot
 * @param actions
 */
export function useMockedViewModel<S, A>(snapshot: S, actions: A): ViewModel<S> & A {
    return useMemo(() => {
        const vm = new MockViewModel<S>(snapshot);
        Object.assign(vm, actions);
        return vm as unknown as ViewModel<S> & A;
    }, [snapshot, actions]);
}
