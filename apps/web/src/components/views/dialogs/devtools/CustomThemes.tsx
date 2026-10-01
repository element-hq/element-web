/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { CustomThemesView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import BaseTool from "./BaseTool";
import SettingsStore from "../../../../settings/SettingsStore";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { CustomThemesViewModel } from "../../../../viewmodels/devtools/CustomThemesViewModel";

interface CustomThemesProps {
    /** Callback to invoke when the back button is clicked. */
    onBack(this: void): void;
}

/**
 * Developer tool for installing custom themes from a URL, and removing installed ones.
 */
export function CustomThemes({ onBack }: CustomThemesProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(
        () => new CustomThemesViewModel({ settingsStore: SettingsStore, dispatcher: defaultDispatcher }),
    );

    return (
        <BaseTool onBack={onBack} className="mx_CustomThemes">
            <CustomThemesView vm={vm} />
        </BaseTool>
    );
}
