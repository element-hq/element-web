/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useSyncExternalStore } from "react";
import { type JSX } from "react";

import { type TextualEventViewModel } from "../../../viewmodels/event-tiles/TextualEventViewModel";

interface Props {
    vm: TextualEventViewModel;
}

export function TextualEvent({ vm }: Props): JSX.Element {
    const text = useSyncExternalStore(vm.subscribe, vm.getSnapshot);

    return <div className="mx_TextualEvent">{text}</div>;
}
