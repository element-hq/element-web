/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useSyncExternalStore, type JSX } from "react";

import { type ViewModel } from "../../../viewmodels/ViewModel";

export type TextualEventViewSnapshot = string | ReactNode;

interface Props {
    vm: ViewModel<TextualEventViewSnapshot>;
}

export function TextualEvent({ vm }: Props): JSX.Element {
    const contents = useSyncExternalStore(vm.subscribe, vm.getSnapshot);

    return <div className="mx_TextualEvent">{contents}</div>;
}
