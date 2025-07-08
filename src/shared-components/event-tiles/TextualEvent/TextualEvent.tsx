/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, type JSX } from "react";

import { type ViewModel } from "../../ViewModel";
import { useViewModel } from "../../useViewModel";

export type TextualEventViewSnapshot = string | ReactNode;

export interface Props {
    vm: ViewModel<TextualEventViewSnapshot>;
}

export function TextualEvent({ vm }: Props): JSX.Element {
    const contents = useViewModel(vm);

    return <div className="mx_TextualEvent">{contents}</div>;
}
